import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import './AskTopicsCta.css';

const TOPIC_PREVIEWS = [
  { id: '1', title: 'Thin Endometrium', name: 'Thin Endometrium' },
  { id: '2', title: 'Low Ovarian Reserve & Exosomes', name: 'Low Ovarian Reserve & Exosomes' },
  { id: '3', title: 'Recurrent Implantation Failure', name: 'Recurrent Implantation Failure' },
  { id: '4', title: 'Recurrent Pregnancy Loss', name: 'Recurrent Pregnancy Loss' },
  { id: '5', title: 'Adenomyosis & Fertility', name: 'Adenomyosis & Fertility' },
];

export default function AskTopicsCta() {
  return (
    <section className="section ask-topics-cta" id="ask-questions">
      <div className="container">
        <div className="ask-topics-cta__box">
          <div className="ask-topics-cta__eyebrow">Interactive Faculty Debate</div>
          <h2 className="ask-topics-cta__title">
            ASK QUESTIONS IN <br />
            <span>THE FOLLOWING TOPICS</span>
          </h2>
          <p className="ask-topics-cta__subtitle">
            Attending doctors and delegates can submit questions on <strong>any clinical topic</strong>.
            The 5 focus themes below are suggestions to inspire your questions for live debate during CIIM 2026.
          </p>

          <div className="ask-topics-cta__grid">
            {TOPIC_PREVIEWS.map((topic) => (
              <Link
                key={topic.id}
                to={`/ask-questions?topic=${encodeURIComponent(topic.name)}`}
                className="ask-topics-cta__item"
              >
                <span className="ask-topics-cta__num">{topic.id}</span>
                <span className="ask-topics-cta__name">{topic.title}</span>
                <span className="ask-topics-cta__arrow" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>

          <div className="ask-topics-cta__action">
            <Link to="/ask-questions" className="btn btn--accent btn--lg">
              Ask Your Questions Now
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

