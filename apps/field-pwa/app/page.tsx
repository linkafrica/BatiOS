const evidenceTypes = ['Photo', 'Video', 'Document', 'Measurement'];

const captureChecklist = [
  'GPS locked',
  'Timestamp visible',
  'Contract item selected',
  'Supervisor sign-off needed',
];

const queuedItems = [
  { label: 'Culvert rebar photo', meta: 'Lot A-14 - 2 min ago', status: 'Ready' },
  { label: 'Drainage level reading', meta: 'Lot A-11 - needs note', status: 'Draft' },
  { label: 'Concrete delivery note', meta: 'Lot A-09 - synced', status: 'Sent' },
];

export default function Page() {
  return (
    <main className="field-shell" aria-label="Field evidence capture">
      <section className="topbar" aria-label="Current assignment">
        <div>
          <p className="eyebrow">BatiOS Field</p>
          <h1>Evidence capture</h1>
        </div>
        <div className="sync-panel" aria-label="Sync status">
          <span className="status-dot" aria-hidden="true" />
          <span>Online</span>
        </div>
      </section>

      <section className="assignment-band" aria-label="Work package">
        <div>
          <p className="eyebrow">Active work package</p>
          <h2>Kasoa drainage channel - Lot A</h2>
        </div>
        <dl className="assignment-grid">
          <div>
            <dt>Contract ref</dt>
            <dd>GH-PW-2026-014</dd>
          </div>
          <div>
            <dt>Chainage</dt>
            <dd>2+450 to 2+780</dd>
          </div>
          <div>
            <dt>Inspector</dt>
            <dd>Ama Mensah</dd>
          </div>
        </dl>
      </section>

      <section className="workflow-grid" aria-label="Capture workflow">
        <form className="capture-panel" action="#" aria-label="New evidence record">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Step 1</p>
              <h2>New evidence record</h2>
            </div>
            <span className="record-id">Draft EV-1048</span>
          </div>

          <label className="field">
            <span>Contract item</span>
            <select name="contractItem" defaultValue="culvert-rebar">
              <option value="culvert-rebar">Culvert reinforcement</option>
              <option value="drainage-excavation">Drainage excavation</option>
              <option value="concrete-pour">Concrete pour</option>
              <option value="delivery-note">Material delivery</option>
            </select>
          </label>

          <fieldset className="segmented">
            <legend>Evidence type</legend>
            <div>
              {evidenceTypes.map((type) => (
                <label key={type}>
                  <input
                    type="radio"
                    name="evidenceType"
                    value={type.toLowerCase()}
                    defaultChecked={type === 'Photo'}
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="upload-target">
            <span className="upload-icon" aria-hidden="true">
              +
            </span>
            <span>
              <strong>Add capture</strong>
              <small>Camera, gallery, or file</small>
            </span>
            <input name="capture" type="file" accept="image/*,video/*,.pdf" />
          </label>

          <div className="two-column">
            <label className="field">
              <span>Location</span>
              <input name="location" defaultValue="5.5348, -0.4167" />
            </label>
            <label className="field">
              <span>Measured quantity</span>
              <input name="quantity" inputMode="decimal" defaultValue="18.5 m" />
            </label>
          </div>

          <label className="field">
            <span>Field note</span>
            <textarea
              name="note"
              rows={4}
              defaultValue="Rebar spacing checked against drawing S-204 before pour."
            />
          </label>

          <fieldset className="checklist">
            <legend>Verification checks</legend>
            {captureChecklist.map((item, index) => (
              <label key={item}>
                <input type="checkbox" name="checks" value={item} defaultChecked={index < 3} />
                <span>{item}</span>
              </label>
            ))}
          </fieldset>

          <div className="action-row">
            <button type="button" className="secondary-action">
              Save draft
            </button>
            <button type="submit" className="primary-action">
              Submit evidence
            </button>
          </div>
        </form>

        <aside className="review-panel" aria-label="Review queue">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Step 2</p>
              <h2>Review queue</h2>
            </div>
            <span className="queue-count">3 items</span>
          </div>

          <ol className="queue-list">
            {queuedItems.map((item) => (
              <li key={item.label}>
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.meta}</span>
                </div>
                <mark>{item.status}</mark>
              </li>
            ))}
          </ol>

          <div className="handoff-box">
            <p className="eyebrow">Next approver</p>
            <strong>Site supervisor</strong>
            <span>Evidence will move to PM review after supervisor sign-off.</span>
          </div>
        </aside>
      </section>
    </main>
  );
}
