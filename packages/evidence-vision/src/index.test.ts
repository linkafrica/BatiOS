import { describe, expect, it } from 'vitest';

import {
  assertAuditableVisionRequest,
  createEvidenceVision,
  requiresHumanReview,
  type EvidenceVisionAuditEvent,
  type EvidenceVisionProviderClient,
  type EvidenceVisionRequest,
} from './index.js';

const requestedAt = new Date('2026-04-29T09:00:00.000Z');
const completedAt = new Date('2026-04-29T09:00:02.000Z');

function baseRequest(overrides: Partial<EvidenceVisionRequest> = {}): EvidenceVisionRequest {
  return {
    provider: 'local',
    model: 'batios-vision-local',
    artifacts: [
      {
        artifactId: 'artifact_01',
        type: 'image',
        uri: 's3://batios-evidence/project-01/photo-01.jpg',
        sha256: 'a'.repeat(64),
        capturedAt: new Date('2026-04-29T08:59:00.000Z'),
        capturedByUserId: 'user_01',
        location: {
          latitude: 5.6037,
          longitude: -0.187,
          accuracyMeters: 8,
        },
        declaredWorkItemId: 'work_01',
      },
    ],
    metadata: {
      requestId: 'vision_req_01',
      organisationId: '33333333-3333-4333-8333-333333333333',
      projectId: '22222222-2222-4222-8222-222222222222',
      actorUserId: '44444444-4444-4444-8444-444444444444',
      purpose: 'site-progress-verification',
      custodyScope: 'project-joint-custody',
      policyTags: ['no-training', 'human-review-required'],
      retention: 'audit-log',
      requestedAt,
      traceId: 'trace_vision_01',
    },
    ...overrides,
  };
}

describe('evidence vision boundary', () => {
  it('requires auditable metadata and at least one artifact', () => {
    expect(() =>
      assertAuditableVisionRequest(
        baseRequest({
          artifacts: [],
        }),
      ),
    ).toThrow('artifacts must contain at least one artifact');

    expect(() =>
      assertAuditableVisionRequest(
        baseRequest({
          metadata: {
            ...baseRequest().metadata,
            policyTags: [],
          },
        }),
      ),
    ).toThrow('metadata.policyTags must contain at least one policy tag');
  });

  it('routes provider calls through policy and audit hooks', async () => {
    const events: EvidenceVisionAuditEvent[] = [];
    const providerCalls: EvidenceVisionRequest[] = [];
    const provider: EvidenceVisionProviderClient = {
      async analyze(request) {
        providerCalls.push(request);
        return {
          requestId: 'provider-id',
          provider: 'local',
          model: 'provider-model',
          observations: [
            {
              observationId: 'obs_01',
              artifactId: 'artifact_01',
              kind: 'progress-indicator',
              label: 'Drainage trench visible',
              summary: 'The image shows an excavated drainage trench along the road shoulder.',
              confidence: 0.91,
              severity: 'info',
              reviewRequired: true,
              recommendedAction: 'Confirm trench dimensions before payment certification.',
            },
          ],
          provenance: {
            sourceArtifactIds: ['provider-artifact-id'],
            modelVersion: 'local-test',
          },
          completedAt,
        };
      },
    };

    const vision = createEvidenceVision({
      providers: {
        local: provider,
        openai: undefined,
        google: undefined,
        aws: undefined,
        azure: undefined,
      },
      auditSink: {
        async record(event) {
          events.push(event);
        },
      },
      policy: {
        async evaluate(request) {
          return { allowed: request.metadata.custodyScope === 'project-joint-custody' };
        },
      },
    });

    const response = await vision.analyze(baseRequest());

    expect(providerCalls).toHaveLength(1);
    expect(response).toMatchObject({
      requestId: 'vision_req_01',
      provider: 'local',
      model: 'batios-vision-local',
      provenance: {
        sourceArtifactIds: ['artifact_01'],
      },
    });
    expect(events.map((event) => event.outcome)).toEqual(['accepted', 'completed']);
    expect(events[0]).toMatchObject({
      requestId: 'vision_req_01',
      organisationId: '33333333-3333-4333-8333-333333333333',
      projectId: '22222222-2222-4222-8222-222222222222',
      artifactIds: ['artifact_01'],
      purpose: 'site-progress-verification',
      custodyScope: 'project-joint-custody',
      retention: 'audit-log',
    });
    expect(events[1]).toMatchObject({
      outcome: 'completed',
      completedAt,
      observationCount: 1,
      reviewRequired: true,
    });
  });

  it('audits rejected requests without calling the provider', async () => {
    const events: EvidenceVisionAuditEvent[] = [];
    const providerCalls: EvidenceVisionRequest[] = [];
    const vision = createEvidenceVision({
      providers: {
        local: {
          async analyze(request) {
            providerCalls.push(request);
            throw new Error('should not call provider');
          },
        },
        openai: undefined,
        google: undefined,
        aws: undefined,
        azure: undefined,
      },
      auditSink: {
        async record(event) {
          events.push(event);
        },
      },
      policy: {
        async evaluate() {
          return { allowed: false, reason: 'artifact custody is not approved' };
        },
      },
    });

    await expect(vision.analyze(baseRequest())).rejects.toThrow('artifact custody is not approved');

    expect(providerCalls).toHaveLength(0);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      outcome: 'rejected',
      reason: 'artifact custody is not approved',
    });
  });

  it('requires human review for lower confidence observations', async () => {
    expect(
      requiresHumanReview([
        {
          observationId: 'obs_02',
          artifactId: 'artifact_01',
          kind: 'defect-risk',
          label: 'Possible concrete cracking',
          summary: 'A visible line may indicate a surface crack.',
          confidence: 0.72,
          severity: 'medium',
          reviewRequired: false,
        },
      ]),
    ).toBe(true);
  });
});
