import { describe, expect, it } from 'vitest';

import {
  toArtifactEventInsert,
  toVisionObservationArtifactEventInput,
  type ArtifactEventInput,
} from './artifact-events.js';

const baseInput: ArtifactEventInput = {
  artifactId: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  organisationId: '33333333-3333-4333-8333-333333333333',
  eventType: 'artifact.created',
  actorUserId: '44444444-4444-4444-8444-444444444444',
  idempotencyKey: 'artifact:11111111-1111-4111-8111-111111111111:create',
  payload: {
    artifactKind: 'invoice',
    amount: 125000,
    tags: ['contract', 'payment'],
    verified: false,
  },
};

describe('artifact event append input', () => {
  it('maps typed domain input to the append-only table shape', () => {
    const occurredAt = new Date('2026-04-27T10:00:00.000Z');
    const insert = toArtifactEventInsert({
      ...baseInput,
      eventId: '55555555-5555-4555-8555-555555555555',
      eventVersion: 2,
      occurredAt,
      causationId: '66666666-6666-4666-8666-666666666666',
      correlationId: '77777777-7777-4777-8777-777777777777',
    });

    expect(insert).toEqual({
      event_id: '55555555-5555-4555-8555-555555555555',
      artifact_id: baseInput.artifactId,
      project_id: baseInput.projectId,
      organisation_id: baseInput.organisationId,
      event_type: 'artifact.created',
      event_version: 2,
      occurred_at: occurredAt,
      actor_user_id: baseInput.actorUserId,
      idempotency_key: baseInput.idempotencyKey,
      payload: baseInput.payload,
      causation_id: '66666666-6666-4666-8666-666666666666',
      correlation_id: '77777777-7777-4777-8777-777777777777',
    });
  });

  it('defaults event version and nullable linkage fields for append callers', () => {
    const insert = toArtifactEventInsert(baseInput);

    expect(insert.event_version).toBe(1);
    expect(insert.occurred_at).toBeInstanceOf(Date);
    expect(insert.causation_id).toBeNull();
    expect(insert.correlation_id).toBeNull();
    expect(insert).not.toHaveProperty('event_id');
  });

  it('maps evidence vision observations to append-only artifact events', () => {
    const completedAt = new Date('2026-04-29T12:00:00.000Z');
    const input = toVisionObservationArtifactEventInput({
      response: {
        requestId: 'vision_req_01',
        provider: 'local',
        model: 'batios-vision-local',
        completedAt,
        provenance: {
          sourceArtifactIds: ['11111111-1111-4111-8111-111111111111'],
          modelVersion: 'local-test',
          providerResponseId: 'provider_01',
          promptHash: 'prompt_hash_01',
        },
        observations: [
          {
            observationId: 'obs_01',
            artifactId: '11111111-1111-4111-8111-111111111111',
            kind: 'progress-indicator',
            label: 'Drainage trench visible',
            summary: 'The uploaded image shows an excavated drainage trench.',
            confidence: 0.91,
            severity: 'info',
            reviewRequired: true,
            recommendedAction: 'Confirm dimensions before payment certification.',
          },
        ],
      },
      artifactId: '11111111-1111-4111-8111-111111111111',
      projectId: '22222222-2222-4222-8222-222222222222',
      organisationId: '33333333-3333-4333-8333-333333333333',
      actorUserId: '44444444-4444-4444-8444-444444444444',
      causationId: '88888888-8888-4888-8888-888888888888',
      correlationId: '99999999-9999-4999-8999-999999999999',
    });

    expect(input).toMatchObject({
      artifactId: '11111111-1111-4111-8111-111111111111',
      projectId: '22222222-2222-4222-8222-222222222222',
      organisationId: '33333333-3333-4333-8333-333333333333',
      eventType: 'artifact.vision.observed',
      occurredAt: completedAt,
      actorUserId: '44444444-4444-4444-8444-444444444444',
      idempotencyKey:
        'artifact:11111111-1111-4111-8111-111111111111:vision:vision_req_01:batios-vision-local',
      causationId: '88888888-8888-4888-8888-888888888888',
      correlationId: '99999999-9999-4999-8999-999999999999',
    });
    expect(input.payload).toMatchObject({
      requestId: 'vision_req_01',
      provider: 'local',
      model: 'batios-vision-local',
      completedAt: '2026-04-29T12:00:00.000Z',
      artifactId: '11111111-1111-4111-8111-111111111111',
      sourceArtifactIds: ['11111111-1111-4111-8111-111111111111'],
      modelVersion: 'local-test',
      providerResponseId: 'provider_01',
      promptHash: 'prompt_hash_01',
      observationCount: 1,
      reviewRequired: true,
      observations: [
        {
          observationId: 'obs_01',
          kind: 'progress-indicator',
          label: 'Drainage trench visible',
          confidence: 0.91,
          reviewRequired: true,
        },
      ],
    });
  });

  it('rejects vision event mapping when no observation matches the artifact', () => {
    expect(() =>
      toVisionObservationArtifactEventInput({
        response: {
          requestId: 'vision_req_02',
          provider: 'local',
          model: 'batios-vision-local',
          completedAt: new Date('2026-04-29T12:00:00.000Z'),
          provenance: {
            sourceArtifactIds: ['different-artifact'],
          },
          observations: [
            {
              observationId: 'obs_02',
              artifactId: 'different-artifact',
              kind: 'unknown',
              label: 'No visible work item',
              summary: 'The uploaded image did not match the requested artifact.',
              confidence: 0.5,
              reviewRequired: true,
            },
          ],
        },
        artifactId: '11111111-1111-4111-8111-111111111111',
        projectId: '22222222-2222-4222-8222-222222222222',
        organisationId: '33333333-3333-4333-8333-333333333333',
        actorUserId: '44444444-4444-4444-8444-444444444444',
      }),
    ).toThrow('vision response contains no observations for artifact');
  });
});
