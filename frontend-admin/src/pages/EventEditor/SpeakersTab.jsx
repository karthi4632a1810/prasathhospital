import { useState } from 'react';
import { eventApi } from '../../lib/eventApi';
import { useSaveBar } from '../../components/SaveBar';
import RepeatingListEditor from '../../components/RepeatingListEditor';
import ImageUploadField from '../../components/ImageUploadField';

export default function SpeakersTab({ event, onSaved }) {
  const [speakers, setSpeakers] = useState(event.speakers || []);

  const { SaveBar } = useSaveBar(async () => {
    const saved = await eventApi.replaceArray(event.id, 'speakers', speakers);
    onSaved({ ...event, speakers: saved.data });
  });

  return (
    <div>
      <RepeatingListEditor
        items={speakers}
        onChange={setSpeakers}
        itemLabel="Speaker"
        newItem={() => ({
          name: '',
          credentials: '',
          designation: '',
          organization: '',
          photoUrl: '',
          bio: '',
          topic: '',
          isKeynote: false,
          order: speakers.length,
        })}
        renderItem={(item, update) => (
          <>
            <div className="field-row">
              <label className="field">
                <span className="field__label">Name</span>
                <input
                  className="field__input"
                  value={item.name}
                  onChange={(e) => update({ name: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field__label">Credentials</span>
                <input
                  className="field__input"
                  placeholder="MBBS, MD (OBG)"
                  value={item.credentials}
                  onChange={(e) => update({ credentials: e.target.value })}
                />
              </label>
            </div>
            <div className="field-row">
              <label className="field">
                <span className="field__label">Designation</span>
                <input
                  className="field__input"
                  value={item.designation}
                  onChange={(e) => update({ designation: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field__label">Organization</span>
                <input
                  className="field__input"
                  value={item.organization}
                  onChange={(e) => update({ organization: e.target.value })}
                />
              </label>
            </div>
            <label className="field">
              <span className="field__label">Session topic</span>
              <input
                className="field__input"
                value={item.topic}
                onChange={(e) => update({ topic: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field__label">Bio</span>
              <textarea
                className="field__textarea"
                maxLength={1500}
                value={item.bio}
                onChange={(e) => update({ bio: e.target.value })}
              />
            </label>
            <ImageUploadField
              label="Photo"
              value={item.photoUrl}
              onChange={(url) => update({ photoUrl: url })}
            />
            <label className="field__label">
              <input
                type="checkbox"
                checked={item.isKeynote}
                onChange={(e) => update({ isKeynote: e.target.checked })}
                style={{ marginRight: 'var(--space-2)' }}
              />
              Keynote speaker
            </label>
          </>
        )}
      />
      {SaveBar}
    </div>
  );
}
