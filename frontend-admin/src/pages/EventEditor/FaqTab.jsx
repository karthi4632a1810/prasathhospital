import { useState } from 'react';
import { eventApi } from '../../lib/eventApi';
import { useSaveBar } from '../../components/SaveBar';
import RepeatingListEditor from '../../components/RepeatingListEditor';

export default function FaqTab({ event, onSaved }) {
  const [faqs, setFaqs] = useState(event.faqs || []);

  const { SaveBar } = useSaveBar(async () => {
    const saved = await eventApi.replaceArray(event.id, 'faqs', faqs);
    onSaved({ ...event, faqs: saved.data });
  });

  return (
    <div>
      <RepeatingListEditor
        items={faqs}
        onChange={setFaqs}
        itemLabel="Question"
        newItem={() => ({ question: '', answer: '', order: faqs.length })}
        renderItem={(item, update) => (
          <>
            <label className="field">
              <span className="field__label">Question</span>
              <input
                className="field__input"
                value={item.question}
                onChange={(e) => update({ question: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field__label">Answer</span>
              <textarea
                className="field__textarea"
                value={item.answer}
                onChange={(e) => update({ answer: e.target.value })}
              />
            </label>
          </>
        )}
      />
      {SaveBar}
    </div>
  );
}
