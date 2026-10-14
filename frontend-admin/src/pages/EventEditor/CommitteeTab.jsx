import { useState } from 'react';
import { eventApi } from '../../lib/eventApi';
import { useSaveBar } from '../../components/SaveBar';
import RepeatingListEditor from '../../components/RepeatingListEditor';
import ImageUploadField from '../../components/ImageUploadField';

const GROUPS = [
  { value: 'leadership', label: 'Leadership' },
  { value: 'scientific', label: 'Scientific Committee' },
  { value: 'organising', label: 'Organising Committee' },
];

export default function CommitteeTab({ event, onSaved }) {
  const [committee, setCommittee] = useState(event.committee || []);

  const { SaveBar } = useSaveBar(async () => {
    const saved = await eventApi.replaceArray(event.id, 'committee', committee);
    onSaved({ ...event, committee: saved.data });
  });

  return (
    <div>
      <RepeatingListEditor
        items={committee}
        onChange={setCommittee}
        itemLabel="Member"
        newItem={() => ({ name: '', role: '', group: 'organising', photoUrl: '', order: committee.length })}
        renderItem={(item, update) => (
          <>
            <div className="field-row">
              <label className="field"><span className="field__label">Name</span>
                <input className="field__input" placeholder="Dr Jane Doe" value={item.name} onChange={(e) => update({ name: e.target.value })} /></label>
              <label className="field"><span className="field__label">Role</span>
                <input className="field__input" placeholder="Organising Chairperson" value={item.role} onChange={(e) => update({ role: e.target.value })} /></label>
            </div>
            <label className="field"><span className="field__label">Group</span>
              <select className="field__select" value={item.group} onChange={(e) => update({ group: e.target.value })}>
                {GROUPS.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </label>
            <ImageUploadField label="Photo" value={item.photoUrl} onChange={(url) => update({ photoUrl: url })} />
          </>
        )}
      />
      {SaveBar}
    </div>
  );
}
