'use strict';

/**
 * Seeds one complete, realistic event so the microsite can be demoed end to end.
 * Safe to re-run: it upserts by slug.
 *
 *   npm run seed
 */

const { connectDatabase, disconnectDatabase } = require('../config/database');
const Event = require('../models/Event');
const TicketType = require('../models/TicketType');
const logger = require('../utils/logger');

const SLUG = 'fertility-gynaecology-summit-2026';

/** Returns a date N days from today at the given hour (IST-ish wall clock). */
function daysFromNow(days, hours = 9, minutes = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

const eventData = {
  title: 'CIIM 2026',
  slug: SLUG,
  tagline: 'Breaking Boundaries, Elevating Surgical Precision & ART Outcomes',
  summary:
    'The 5th Annual Conference on Controversies in Infertility Management — in-person at The Leela Palace, Chennai, with live tele-transmission of a historic cross-geography robotic surgery demonstration. High-impact debates, masterclasses and emerging-tech sessions for 800+ delegates.',
  description:
    'Greetings from Dr. Geetha Haripriya, Chairperson, Prashanth Fertility and Research Centre Pvt. Ltd. We are delighted to welcome you to the prestigious 5th CIIM, to be held from November 21st – 22nd, 2026. CIIM 2026 will truly be an unforgettable conference for all who attend.\n\nThe conference aims to ideate, analyze, and share inventive, feasible, and implementable ways to encourage and disseminate knowledge, education, and research to make a high level of care available to women. The Organizing Committee is working hard to put together an educational and scientific program for what will be an academic extravaganza, packaged with cuisine to tantalize your taste buds, and a complete cultural fest.',

  category: 'conference',
  mode: 'in-person',
  status: 'published',

  startDate: new Date('2026-11-21T09:00:00+05:30'),
  endDate: new Date('2026-11-22T17:30:00+05:30'),
  timezone: 'Asia/Kolkata',

  registrationOpensAt: daysFromNow(-10, 0, 0),
  registrationClosesAt: new Date('2026-11-20T23:59:00+05:30'),

  capacity: 800,
  registeredCount: 182,

  sections: {
    announcements: true,
    hero: true,
    chairpersonWelcome: true,
    about: true,
    speakers: true,
    committee: true,
    agenda: true,
    tickets: true,
    venue: true,
    sponsors: true,
    exhibitStalls: false,
    faqs: true,
    finalCta: true,
    stickyCta: true,
  },

  organizer: {
    name: 'Prashanth Fertility and Research Centre Pvt. Ltd.',
    department: 'Prashanth Fertility',
    logoUrl: '/assets/prashanth-hospitals-crest.jpg',
    websiteUrl: 'https://www.prashanthhospitals.com',
  },

  venue: {
    name: 'The Leela Palace',
    addressLine1: '',
    addressLine2: '',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '',
    landmark: '',
    mapEmbedUrl: 'https://www.google.com/maps?q=The+Leela+Palace+Chennai&output=embed',
    mapLink: 'https://maps.google.com/?q=The+Leela+Palace+Chennai',
    latitude: null,
    longitude: null,
    parkingInfo: '',
  },

  highlights: [
    'Live Tele-Robotics: streamed high-definition remote surgical demonstration',
    'Debates & Panels: high-impact sessions on contested infertility & ART protocols',
    'Masterclasses: hands-on insights led by renowned international & national faculty',
    'Emerging Tech: innovations in embryology, AI in IVF and reproductive surgery',
  ],

  // Expected faculty — invited, session topics/credentials/photos to follow
  // once the scientific programme is finalised (photos added via the admin
  // CMS Speakers tab).
  speakers: [
    {
      name: "Dr. Geetha Haripriya",
      credentials: "MD, DGO, FICS, FICOG",
      designation: "Organising Chairperson & Senior Consultant",
      organization: "Prashanth Fertility and Research Centre",
      topic: "Elevating Surgical Precision & ART Outcomes",
      bio: "Pioneer in reproductive medicine and laparoscopic/robotic reproductive surgery with over three decades of clinical excellence.",
      photoUrl: "/assets/chairperson-geetha-haripriya.png",
      isKeynote: true,
      order: 1
    },
    {
      name: "Dr. Jatin Shah",
      credentials: "MD, DGO",
      designation: "Director & IVF Specialist",
      organization: "Mumbai Fertility Clinic",
      topic: "PCOS Stimulation Challenges (Hyper-responder)",
      bio: "Renowned national faculty specializing in complex ovarian stimulation protocols and prevention of OHSS.",
      photoUrl: "",
      isKeynote: true,
      order: 2
    },
    {
      name: "Dr. Abha Majumdar",
      credentials: "MD, FICOG, FICS",
      designation: "Director & Head of Department of Reproductive Medicine",
      organization: "Sir Ganga Ram Hospital, New Delhi",
      topic: "Panel Moderator: Ectopic Endometrium \u2014 Fertility Outcomes",
      bio: "Distinguished fertility specialist and academician with international repute in reproductive endocrinology.",
      photoUrl: "",
      isKeynote: true,
      order: 3
    },
    {
      name: "Dr. Manjula Anagani",
      credentials: "MD, FICOG, Padmashree Awardee",
      designation: "Chief Gynaecologist & Obstetrician, Laparoscopic & Robotic Surgeon",
      organization: "Care Hospitals, Hyderabad",
      topic: "Ovarian Longevity and Rejuvenation: What's New?",
      bio: "Pioneering laparoscopic and robotic gynaecological surgeon recognized nationally for innovations in minimally invasive surgery.",
      photoUrl: "",
      isKeynote: true,
      order: 4
    },
    {
      name: "Dr. Sunil Jindal",
      credentials: "MS, DNB, MCh (Reproductive Medicine)",
      designation: "Senior Andrologist & Fertility Consultant",
      organization: "Jindal Hospital",
      topic: "Aphrodite Criteria Management & Male Reproductive Health",
      bio: "Leading reproductive microsurgeon and andrologist specializing in complex male factor infertility and sperm retrieval.",
      photoUrl: "",
      isKeynote: true,
      order: 5
    },
    {
      name: "Dr. Pankaj Talwar",
      credentials: "MD, VSM, FIAMS",
      designation: "Head of Medical Services",
      organization: "Milann Fertility & AR Kidwai Memorial",
      topic: "AI in IVF & Embryo Selection: Can Technology Improve Outcomes?",
      bio: "Pioneer in clinical embryology, AI-driven time-lapse selection, and reproductive lab quality control.",
      photoUrl: "",
      isKeynote: true,
      order: 6
    },
    {
      name: "Dr. Jayesh Amin",
      credentials: "MD, F.ART (Singapore)",
      designation: "Clinical Director",
      organization: "Wings Hospitals",
      topic: "Immunomodulators in Reproductive Medicine",
      bio: "Leading IVF clinician with extensive focus on recurrent implantation failure and immunologic interventions.",
      photoUrl: "",
      isKeynote: false,
      order: 7
    },
    {
      name: "Dr. Jay Mehta",
      credentials: "MD, DNB, FCPS",
      designation: "Scientific Director & Pelvic Surgeon",
      organization: "Shree IVF Clinic, Mumbai",
      topic: "Tackling Endometriosis",
      bio: "Specialist in advanced excision of deep infiltrating endometriosis and fertility-preserving surgeries.",
      photoUrl: "",
      isKeynote: false,
      order: 8
    },
    {
      name: "Dr. Hafeez",
      credentials: "MD, DGO",
      designation: "Chairman & Advanced Laparoscopic Surgeon",
      organization: "Sunrise Hospital, Kochi",
      topic: "Surgical Scenarios in Adenomyosis",
      bio: "Globally acclaimed endoscopic surgeon specializing in complex conservative adenomyomectomies.",
      photoUrl: "",
      isKeynote: false,
      order: 9
    },
    {
      name: "Dr. Devika Gunasheela",
      credentials: "MS, MRCOG (UK)",
      designation: "Managing Director & Senior Consultant",
      organization: "Gunasheela Fertility Centre, Bengaluru",
      topic: "Lymphocytic Immunisation Therapy (LIT)",
      bio: "Expert in reproductive immunology, recurrent miscarriage, and personalised ART therapies.",
      photoUrl: "",
      isKeynote: false,
      order: 10
    },
    {
      name: "Dr. Asha Rao",
      credentials: "MD, DGO",
      designation: "Medical Director",
      organization: "Rao Hospital, Coimbatore",
      topic: "Adenomyosis: Medical Management and Fertility Outcomes",
      bio: "Renowned gynaecologist and fertility specialist with extensive research in uterine factor infertility.",
      photoUrl: "",
      isKeynote: false,
      order: 11
    },
    {
      name: "Dr. Asha Baxi",
      credentials: "MS, FICOG, FRCOG",
      designation: "Senior Consultant & IVF Specialist",
      organization: "Disha Fertility Centre, Indore",
      topic: "Elective Egg Freezing & Atypical Endometrial Hyperplasia",
      bio: "Senior reproductive medicine consultant and academic authority on fertility preservation.",
      photoUrl: "",
      isKeynote: false,
      order: 12
    },
    {
      name: "Dr. Padmapriya Vivek",
      credentials: "MD, DGO, Dip. Lap",
      designation: "Head of Obstetrics, Gynaecology & Robotic Surgery",
      organization: "Gleneagles HealthCity",
      topic: "Live Tele-Robotic Surgery Demonstration (Moderator)",
      bio: "Expert robotic and laparoscopic gynaecological surgeon leading live surgical demonstration tracks.",
      photoUrl: "",
      isKeynote: false,
      order: 13
    },
    {
      name: "Dr. Ranjith Ramaswamy",
      credentials: "MS, DNB, FECSM",
      designation: "Director of Male Reproductive Medicine",
      organization: "Department of Urology",
      topic: "Panel Discussion: Male Reproductive Health (Moderator)",
      bio: "Distinguished andrologist and reproductive microsurgeon.",
      photoUrl: "",
      isKeynote: false,
      order: 14
    },
    {
      name: "Dr. Rohit Gutgutia",
      credentials: "MD, DGO, FICOG",
      designation: "Medical Director",
      organization: "Nova IVF Fertility, Eastern Region",
      topic: "Fluid in Cavity \u2014 Does It Matter?",
      bio: "Senior fertility clinician with prominent contributions to evidence-based embryo transfer protocols.",
      photoUrl: "",
      isKeynote: false,
      order: 15
    },
    {
      name: "Dr. Kundan Ingle",
      credentials: "MD, DNB, FCPS",
      designation: "President & Senior Consultant",
      organization: "FOGSI / Oasis Fertility",
      topic: "IVF Courtroom: Ethical & Medico-Legal Conundrums",
      bio: "Leading authority on ART regulatory frameworks, ethical practice, and medical jurisprudence.",
      photoUrl: "",
      isKeynote: false,
      order: 16
    },
    {
      name: "Dr. Sanjeev Reddy",
      credentials: "MD, DGO, FRCOG",
      designation: "Professor & Head of Reproductive Medicine",
      organization: "Sri Ramachandra Institute of Higher Education and Research",
      topic: "Microbiome Impact in Fertility Care: Pre- and Probiotics in ART",
      bio: "Academic leader and clinical specialist focusing on reproductive endocrinology and mucosal immunology.",
      photoUrl: "",
      isKeynote: false,
      order: 17
    },
    {
      name: "Dr. Chinmay Patkar",
      credentials: "MS (OBGYN), Fellowship in Andrology",
      designation: "Consultant Andrologist",
      organization: "Patkar Clinic",
      topic: "Optimisation of Sperm Before IVF (DFI)",
      bio: "Specialist in advanced male fertility diagnostics and sperm DNA integrity management.",
      photoUrl: "",
      isKeynote: false,
      order: 18
    },
    {
      name: "Dr. Aarthi Deenadayalan",
      credentials: "MD, DGO",
      designation: "Lead Consultant in Reproductive Sonology",
      organization: "Deenadayal Fertility Clinic",
      topic: "Quality Ultrasound in ART",
      bio: "Expert sonologist specialized in high-resolution 3D pelvic ultrasound and follicular monitoring.",
      photoUrl: "",
      isKeynote: false,
      order: 19
    },
    {
      name: "Dr. Kurian Joseph",
      credentials: "MD, DGO, FRCOG",
      designation: "Director & Consultant Gynaecologist",
      organization: "Joseph Hospital",
      topic: "Managing Reproductive Tract Anomalies",
      bio: "Renowned pelvic surgeon and Mullerian anomaly reconstructive specialist.",
      photoUrl: "",
      isKeynote: false,
      order: 20
    },
    {
      name: "Dr. Ramani Devi",
      credentials: "MD, DGO, FICS",
      designation: "Senior Consultant Obstetrician & Gynaecologist",
      organization: "Ramakrishna Medical Centre",
      topic: "Adolescent Endometriosis and Adenomyosis",
      bio: "Senior clinician dedicated to adolescent reproductive health and fertility preservation.",
      photoUrl: "",
      isKeynote: false,
      order: 21
    },
    {
      name: "Dr. Vanitha Anban",
      credentials: "MS (OG), Fellow in Minimal Access Surgery",
      designation: "Consultant Endoscopic Surgeon",
      organization: "Prashanth Hospitals",
      topic: "Role of Metroplasty",
      bio: "Specialist in hysteroscopic uterine reconstruction and reproductive surgeries.",
      photoUrl: "",
      isKeynote: false,
      order: 22
    },
    {
      name: "Dr. Jayarani Kamaraj",
      credentials: "MD, DGO, PhD (Sexual Medicine)",
      designation: "Senior Sexual Medicine Specialist",
      organization: "Aakash Fertility Centre & Hospital",
      topic: "Sexual Dysfunction and Vaginismus",
      bio: "Renowned sexual health consultant addressing psycho-sexual dysfunctions impacting conception.",
      photoUrl: "",
      isKeynote: false,
      order: 23
    },
    {
      name: "Dr. Vasundhara Jagannathan",
      credentials: "MD, DNB, FNB (Reproductive Medicine)",
      designation: "Senior Consultant",
      organization: "Oasis Fertility",
      topic: "The Cytokine Storm in Pregnancy",
      bio: "Expert in maternal-fetal immune interactions and recurrent pregnancy loss.",
      photoUrl: "",
      isKeynote: false,
      order: 24
    },
    {
      name: "Dr. Sunkulp Jain",
      credentials: "MS (OBGYN), Fellow in Reproductive Medicine",
      designation: "Consultant Fertility Specialist",
      organization: "Jain Fertility Centre",
      topic: "Stimulation Protocols in Non-IVF Cycles",
      bio: "Clinical specialist in ovulation induction, monofollicular protocols, and IUI management.",
      photoUrl: "",
      isKeynote: false,
      order: 25
    },
    {
      name: "Dr. Ashwin Karuppan",
      credentials: "MD (Gen Med), Diabetologist & Endocrinologist",
      designation: "Consultant Physician & Metabolic Specialist",
      organization: "Prashanth Hospitals",
      topic: "Obesity and Reproductive Outcomes",
      bio: "Metabolic health authority specializing in insulin resistance, obesity management, and gestational outcomes.",
      photoUrl: "",
      isKeynote: false,
      order: 26
    },
    {
      name: "Dr. Samhitha Moturi",
      credentials: "MS (OBGYN), Fellowship in Reproductive Medicine",
      designation: "Organising Secretary & Consultant Fertility Specialist",
      organization: "Prashanth Fertility and Research Centre",
      topic: "Capsule: Recent Advances in Reproductive Health",
      bio: "Organising Secretary for CIIM 2026, leading scientific programme coordination and clinical reproductive care.",
      photoUrl: "",
      isKeynote: false,
      order: 27
    },
  ],

  committee: [
    { name: 'Dr Geetha Haripriya', role: 'Organising Chairperson', group: 'leadership', photoUrl: '/assets/chairperson-geetha-haripriya.png', order: 1 },
    { name: 'Dr Samhitha Moturi', role: 'Organising Secretary', group: 'leadership', photoUrl: '', order: 2 },

    { name: 'Dr Swathi', role: '', group: 'scientific', photoUrl: '', order: 1 },
    { name: 'Dr Malsri', role: '', group: 'scientific', photoUrl: '', order: 2 },
    { name: 'Dr Anuradha', role: '', group: 'scientific', photoUrl: '', order: 3 },
    { name: 'Dr Veena', role: '', group: 'scientific', photoUrl: '', order: 4 },
    { name: 'Dr Usha Todadri', role: '', group: 'scientific', photoUrl: '', order: 5 },
    { name: 'Dr Abrajdha', role: '', group: 'scientific', photoUrl: '', order: 6 },
    { name: 'Dr Sailaja', role: '', group: 'scientific', photoUrl: '', order: 7 },
    { name: 'Dr Sughija', role: '', group: 'scientific', photoUrl: '', order: 8 },
    { name: 'Dr Madhumitha', role: '', group: 'scientific', photoUrl: '', order: 9 },
    { name: 'Dr Selvapriya', role: '', group: 'scientific', photoUrl: '', order: 10 },
    { name: 'Dr Pushpalatha', role: '', group: 'scientific', photoUrl: '', order: 11 },
    { name: 'Dr Sabia Nikath', role: '', group: 'scientific', photoUrl: '', order: 12 },

    { name: 'Dr Jenifer', role: '', group: 'organising', photoUrl: '', order: 1 },
    { name: 'Dr Radhika', role: '', group: 'organising', photoUrl: '', order: 2 },
    { name: 'Dr Sreejanani', role: '', group: 'organising', photoUrl: '', order: 3 },
    { name: 'Dr Seeniammal', role: '', group: 'organising', photoUrl: '', order: 4 },
    { name: 'Dr Divya', role: '', group: 'organising', photoUrl: '', order: 5 },
    { name: 'Dr Priyanka', role: '', group: 'organising', photoUrl: '', order: 6 },
    { name: 'Dr Divya', role: '', group: 'organising', photoUrl: '', order: 7 },
    { name: 'Dr Subhasree', role: '', group: 'organising', photoUrl: '', order: 8 },
    { name: 'Dr Sobhana', role: '', group: 'organising', photoUrl: '', order: 9 },
  ],

  agenda: [
    {
      date: new Date('2026-11-21T00:00:00+05:30'),
      label: 'Day 1 — Infertility Controversies, Reproductive Surgery & Tele-Robotics',
      items: [
        {
          startTime: "08:30",
          endTime: "08:40",
          title: "Capsule 1: Letrozole in Male Infertility",
          description: "Evidence and clinical protocols for letrozole in male factor infertility.",
          speakerNames: [],
          type: "session",
          track: "Main Auditorium",
          order: 1
        },
        {
          startTime: "08:40",
          endTime: "08:50",
          title: "Capsule 2: IUI to ICSI Transition",
          description: "Clinical thresholds, timing, and patient selection when moving from IUI to ICSI.",
          speakerNames: [],
          type: "session",
          track: "Main Auditorium",
          order: 2
        },
        {
          startTime: "08:50",
          endTime: "09:00",
          title: "Capsule 3: Sclerotherapy in Endometriosis",
          description: "Minimally invasive sclerotherapy techniques for ovarian endometriomas.",
          speakerNames: [],
          type: "session",
          track: "Main Auditorium",
          order: 3
        },
        {
          startTime: "09:00",
          endTime: "09:20",
          title: "Microwave Ablation in Gynaecology",
          description: "Technological principles and surgical applications of microwave ablation.",
          speakerNames: [
            "Faculty (TBD)"
          ],
          type: "session",
          track: "Main Auditorium",
          order: 4
        },
        {
          startTime: "09:20",
          endTime: "09:35",
          title: "Role of Metroplasty",
          description: "Surgical techniques and fertility outcomes following uterine metroplasty.",
          speakerNames: [
            "Dr. Vanitha Anban"
          ],
          type: "session",
          track: "Main Auditorium",
          order: 5
        },
        {
          startTime: "09:35",
          endTime: "09:55",
          title: "Surgical Scenarios in Adenomyosis",
          description: "Case-based surgical dilemmas and fertility-preserving excision in diffuse adenomyosis.",
          speakerNames: [
            "Dr. Hafeez"
          ],
          type: "session",
          track: "Main Auditorium",
          order: 6
        },
        {
          startTime: "09:55",
          endTime: "10:25",
          title: "Tackling Endometriosis",
          description: "Comprehensive surgical and medical strategies for deep infiltrating endometriosis.",
          speakerNames: [
            "Dr. Jay Mehta"
          ],
          type: "session",
          track: "Main Auditorium",
          order: 7
        },
        {
          startTime: "10:25",
          endTime: "10:40",
          title: "Adolescent Endometriosis and Adenomyosis",
          description: "Early identification, fertility preservation, and conservative management in adolescents.",
          speakerNames: [
            "Dr. Ramani Devi"
          ],
          type: "session",
          track: "Main Auditorium",
          order: 8
        },
        {
          startTime: "10:40",
          endTime: "11:00",
          title: "Adenomyosis: Medical Management and Fertility Outcomes",
          description: "Optimizing endometrial receptivity and pregnancy rates through medical protocols.",
          speakerNames: [
            "Dr. Asha Rao"
          ],
          type: "session",
          track: "Main Auditorium",
          order: 9
        },
        {
          startTime: "11:00",
          endTime: "11:30",
          title: "Panel Discussion: Ectopic Endometrium \u2014 Fertility Outcomes",
          description: "Interactive panel on surgical vs. medical approaches, recurrence, and ART outcomes.",
          speakerNames: [
            "Dr. Abha Majumdar (Moderator)",
            "Dr. Asha Bakshi",
            "Dr. Madhupriya",
            "Dr. Hafeez",
            "Dr. Jay Mehta",
            "Dr. Jayesh Amin"
          ],
          type: "panel",
          track: "Main Auditorium",
          order: 10
        },
        {
          startTime: "11:30",
          endTime: "11:50",
          title: "Lymphocytic Immunisation Therapy (LIT)",
          description: "Indications, protocol standardisation, and immunologic evaluation in recurrent pregnancy loss.",
          speakerNames: [
            "Dr. Devika Gunasheela"
          ],
          type: "session",
          track: "Immunology Track",
          order: 11
        },
        {
          startTime: "11:50",
          endTime: "12:10",
          title: "The Cytokine Storm in Pregnancy",
          description: "Pathophysiology, systemic inflammation, and therapeutic targets in adverse gestational outcomes.",
          speakerNames: [
            "Dr. Vasundhara Jagannathan"
          ],
          type: "session",
          track: "Immunology Track",
          order: 12
        },
        {
          startTime: "12:10",
          endTime: "12:30",
          title: "Role of KIR / HLA-C in RPL & RIF",
          description: "Maternal-fetal immune compatibility testing and therapeutic implications.",
          speakerNames: [
            "Dr. Anuradha"
          ],
          type: "session",
          track: "Immunology Track",
          order: 13
        },
        {
          startTime: "12:30",
          endTime: "12:50",
          title: "Seminal Fluid Effect on Uterine Receptivity",
          description: "Seminal plasma signaling, immune modulation, and blastocyst implantation.",
          speakerNames: [
            "Dr. Narmadha Venugopal"
          ],
          type: "session",
          track: "Immunology Track",
          order: 14
        },
        {
          startTime: "12:50",
          endTime: "13:10",
          title: "Immunomodulators in Reproductive Medicine",
          description: "Lipids, G-CSF, steroids, and biologics: separating evidence from clinical hype.",
          speakerNames: [
            "Dr. Jayesh Amin"
          ],
          type: "session",
          track: "Immunology Track",
          order: 15
        },
        {
          startTime: "13:10",
          endTime: "13:20",
          title: "Thin Endometrium: Clinical Interventions",
          description: "PRP, regenerative infusions, and hormonal strategies for refractory thin lining.",
          speakerNames: [
            "Dr. Rajesh Kordia"
          ],
          type: "session",
          track: "Immunology Track",
          order: 16
        },
        {
          startTime: "13:20",
          endTime: "14:20",
          title: "Networking Lunch & Poster Viewing",
          description: "Buffet luncheon at The Leela Palace banquet foyer.",
          speakerNames: [],
          type: "break",
          track: "Banquet Hall",
          order: 17
        },
        {
          startTime: "14:20",
          endTime: "14:45",
          title: "Sexual Dysfunction and Vaginismus",
          description: "Clinical evaluation, multidisciplinary therapy, and addressing psycho-sexual barriers in fertility.",
          speakerNames: [
            "Dr. Jayarani Kamaraj"
          ],
          type: "session",
          track: "Main Auditorium",
          order: 18
        },
        {
          startTime: "14:50",
          endTime: "16:30",
          title: "Live Tele-Robotic Surgery Demonstration",
          description: "Landmark high-definition cross-geography remote robotic surgery with live audio-visual dialogue and surgical commentary.",
          speakerNames: [
            "Dr. Padmapriya Vivek (Moderator)",
            "Dr. Malaraj (Moderator)"
          ],
          type: "keynote",
          track: "Main Auditorium",
          order: 19
        }
      ],
    },
    {
      date: new Date('2026-11-22T00:00:00+05:30'),
      label: 'Day 2 — ART, Male Infertility, Genetics & Clinical Debates',
      items: [
        {
          startTime: "08:30",
          endTime: "08:40",
          title: "Capsule 4: Clinical Pearls in ART",
          description: "Focused rapid-fire presentation on practical clinical pearls in daily fertility practice.",
          speakerNames: [],
          type: "session",
          track: "Main Auditorium",
          order: 1
        },
        {
          startTime: "08:40",
          endTime: "08:50",
          title: "Capsule 5: Embryology Insights",
          description: "Key observations from the embryology suite for improving blastocyst conversion.",
          speakerNames: [],
          type: "session",
          track: "Main Auditorium",
          order: 2
        },
        {
          startTime: "08:50",
          endTime: "09:00",
          title: "Capsule 6: Recent Advances",
          description: "Emerging techniques and novel diagnostic protocols in reproductive health.",
          speakerNames: [
            "Dr. Samhitha Moturi"
          ],
          type: "session",
          track: "Main Auditorium",
          order: 3
        },
        {
          startTime: "09:00",
          endTime: "09:15",
          title: "Aphrodite Criteria \u2014 Management",
          description: "Stratification, stimulation protocols, and clinical outcomes using Aphrodite criteria.",
          speakerNames: [
            "Dr. Sunil Jindal"
          ],
          type: "session",
          track: "Main Auditorium",
          order: 4
        },
        {
          startTime: "09:15",
          endTime: "09:30",
          title: "Optimisation of Sperm Before IVF (DFI)",
          description: "DNA fragmentation index management, antioxidants, and microfluidic sperm sorting.",
          speakerNames: [
            "Dr. Chinmay Patkar"
          ],
          type: "session",
          track: "Main Auditorium",
          order: 5
        },
        {
          startTime: "09:30",
          endTime: "10:00",
          title: "Panel Discussion: Male Reproductive Health",
          description: "Comprehensive panel addressing severe male factor infertility, surgical retrieval, and genomics.",
          speakerNames: [
            "Dr. Sunil Jindal (Moderator)",
            "Dr. Ranjith Ramaswamy (Moderator)",
            "Dr. Siddarth",
            "Dr. Sanjay Prakash",
            "Dr. Amnith Kumar",
            "Dr. Rohit Gutgutia"
          ],
          type: "panel",
          track: "Main Auditorium",
          order: 6
        },
        {
          startTime: "10:00",
          endTime: "10:20",
          title: "Quality Ultrasound in ART",
          description: "3D pelvic imaging, antral follicle count standardization, and Doppler assessment.",
          speakerNames: [
            "Dr. Aarthi Deenadayalan"
          ],
          type: "session",
          track: "Main Auditorium",
          order: 7
        },
        {
          startTime: "10:20",
          endTime: "10:40",
          title: "Ovarian Longevity and Rejuvenation: What's New?",
          description: "PRP, stem cell therapies, in vitro activation (IVA), and emerging ovarian longevity science.",
          speakerNames: [
            "Dr. Manjula Anagani"
          ],
          type: "session",
          track: "Main Auditorium",
          order: 8
        },
        {
          startTime: "10:40",
          endTime: "10:55",
          title: "Elective Egg Freezing: Counselling & Real-world Outcomes",
          description: "Oocyte vitrification protocols, survival rates, and patient decision algorithms.",
          speakerNames: [
            "Dr. Lavanya Kiran",
            "Dr. Asha Baxi"
          ],
          type: "session",
          track: "Main Auditorium",
          order: 9
        },
        {
          startTime: "10:55",
          endTime: "11:10",
          title: "Managing Reproductive Tract Anomalies",
          description: "Diagnosis and corrective endoscopic surgery for congenital Mullerian anomalies.",
          speakerNames: [
            "Dr. Kurian Joseph"
          ],
          type: "session",
          track: "Main Auditorium",
          order: 10
        },
        {
          startTime: "11:10",
          endTime: "11:25",
          title: "Atypical Endometrial Hyperplasia: Fertility-Sparing Approaches",
          description: "Medical oncologic management, hysteroscopic monitoring, and ART timing.",
          speakerNames: [
            "Dr. Asha Baxi"
          ],
          type: "session",
          track: "Main Auditorium",
          order: 11
        },
        {
          startTime: "11:25",
          endTime: "11:40",
          title: "Fluid in Cavity \u2014 Does It Matter?",
          description: "Hydrosalpinx, subclinical endometritis, and transfer cancellation criteria.",
          speakerNames: [
            "Dr. Rohit Gutgutia"
          ],
          type: "session",
          track: "Main Auditorium",
          order: 12
        },
        {
          startTime: "11:40",
          endTime: "11:55",
          title: "Fertility in the 40s: Navigating the Biological Clock",
          description: "Aneuploidy rates, personalized stimulation, and realistic success counseling over age 40.",
          speakerNames: [],
          type: "session",
          track: "Main Auditorium",
          order: 13
        },
        {
          startTime: "11:55",
          endTime: "12:10",
          title: "Microbiome Impact in Fertility Care: Pre- and Probiotics in ART Outcomes",
          description: "Endometrial and vaginal dysbiosis, testing modalities, and microbiome restoration.",
          speakerNames: [
            "Dr. Sanjeev Reddy"
          ],
          type: "session",
          track: "Main Auditorium",
          order: 14
        },
        {
          startTime: "12:10",
          endTime: "12:25",
          title: "Chronic Endometriosis \u2014 What is the Current Evidence?",
          description: "Systemic inflammatory impact, ovarian reserve preservation, and updated guidelines.",
          speakerNames: [],
          type: "session",
          track: "Main Auditorium",
          order: 15
        },
        {
          startTime: "12:25",
          endTime: "12:40",
          title: "PCOS Stimulation Challenges (Hyper-responder)",
          description: "GnRH antagonist protocols, agonist trigger, and eliminating OHSS in extreme hyper-responders.",
          speakerNames: [
            "Dr. Jatin Shah"
          ],
          type: "session",
          track: "Main Auditorium",
          order: 16
        },
        {
          startTime: "12:40",
          endTime: "13:00",
          title: "PGT-A and PGT-M in Genetic Testing",
          description: "Next-generation sequencing, monogenic disease screening, mosaicism, and embryo selection.",
          speakerNames: [
            "Dr. Suma",
            "Dr. Vandana Hegde"
          ],
          type: "session",
          track: "Main Auditorium",
          order: 17
        },
        {
          startTime: "13:00",
          endTime: "13:20",
          title: "AI in IVF & Embryo Selection: Can Technology Improve Outcomes?",
          description: "Computer vision, time-lapse algorithms, and predictive modeling in the modern embryology laboratory.",
          speakerNames: [
            "Dr. Pankaj Talwar"
          ],
          type: "session",
          track: "Main Auditorium",
          order: 18
        },
        {
          startTime: "13:20",
          endTime: "14:10",
          title: "Networking Lunch & Exhibition Visit",
          description: "Luncheon and exhibition hall walkthrough.",
          speakerNames: [],
          type: "break",
          track: "Banquet Hall",
          order: 19
        },
        {
          startTime: "14:10",
          endTime: "14:50",
          title: "Special Plenary & Competitive Scientific Presentations",
          description: "Moderated paper presentations and selected abstracts from young investigators.",
          speakerNames: [],
          type: "session",
          track: "Main Auditorium",
          order: 20
        },
        {
          startTime: "14:50",
          endTime: "15:05",
          title: "IVF Courtroom: Ethical & Medico-Legal Conundrums",
          description: "Mock courtroom format examining consent, gamete ownership, and regulation under ART law.",
          speakerNames: [
            "Dr. Kundan Ingle"
          ],
          type: "session",
          track: "Main Auditorium",
          order: 21
        },
        {
          startTime: "15:05",
          endTime: "15:20",
          title: "Chairperson's Address & Keynote",
          description: "Presidential address on elevating surgical precision and ART outcomes by Organising Chairperson Dr. Geetha Haripriya.",
          speakerNames: [
            "Dr. Geetha Haripriya (Dr GHP)"
          ],
          type: "keynote",
          track: "Main Auditorium",
          order: 22
        },
        {
          startTime: "15:20",
          endTime: "15:40",
          title: "Stimulation Protocols in Non-IVF Cycles",
          description: "Safe ovulation induction protocols for timed intercourse and IUI without multiple gestation.",
          speakerNames: [
            "Dr. Sunkulp Jain"
          ],
          type: "session",
          track: "Main Auditorium",
          order: 23
        },
        {
          startTime: "15:40",
          endTime: "16:00",
          title: "Obesity and Reproductive Outcomes",
          description: "Endocrine disruptions, insulin resistance, weight optimisation, and obstetric outcomes.",
          speakerNames: [
            "Dr. Ashwin Karuppan"
          ],
          type: "session",
          track: "Main Auditorium",
          order: 24
        },
        {
          startTime: "16:00",
          endTime: "16:30",
          title: "Valedictory Ceremony, Awards & High Tea",
          description: "Felicitation of faculty, delegate certificates, best paper awards, and closing remarks.",
          speakerNames: [],
          type: "networking",
          track: "Banquet Foyer",
          order: 25
        }
      ],
    },
  ],

  sponsors: [
    { name: 'Prashanth Fertility Research Centre', tier: 'title', logoUrl: '', order: 1 },
    { name: 'Merck Healthcare', tier: 'platinum', logoUrl: '', order: 2 },
    { name: 'Ferring Pharmaceuticals', tier: 'gold', logoUrl: '', order: 3 },
    { name: 'Vitrolife', tier: 'gold', logoUrl: '', order: 4 },
    { name: 'Chennai OBGYN Society', tier: 'partner', logoUrl: '', order: 5 },
  ],

  faqs: [
    {
      question: 'Who should attend CIIM 2026?',
      answer:
        'Reproductive medicine specialists & IVF consultants, gynaecological endoscopic & robotic surgeons, embryologists & clinical reproductive scientists, and obstetricians, gynaecologists & postgraduates.',
      order: 1,
    },
    {
      question: 'Will CME credit points be awarded?',
      answer:
        'Yes. The summit is accredited for 6 CME credit points by the Tamil Nadu Medical Council. Credit requires check-in at the venue and attendance until the valedictory session.',
      order: 2,
    },
    {
      question: 'How do I receive my ticket after registering?',
      answer:
        'Immediately after registration you receive a digital ticket with a unique QR code on WhatsApp and email. Show that QR code at the registration desk on event day.',
      order: 3,
    },
    {
      question: 'Can I register a colleague along with me?',
      answer:
        'Yes. The Couple/Duo pass admits two delegates on a single registration. Each delegate still receives an individual QR code and certificate.',
      order: 4,
    },
    {
      question: 'What is the cancellation and refund policy?',
      answer:
        'Cancellations requested in writing up to 14 days before the event are eligible for a refund less a 10% processing fee. Registrations are transferable to another delegate at no cost.',
      order: 5,
    },
    {
      question: 'Is accommodation provided?',
      answer:
        'Accommodation is not included. Our delegate desk can share a list of partner hotels near the venue with negotiated rates on request.',
      order: 6,
    },
  ],

  announcements: [
    {
      message: 'Early bird pricing closes in 7 days — register now to save ₹500 on delegate passes.',
      level: 'info',
      isActive: true,
      publishedAt: new Date(),
      expiresAt: daysFromNow(7, 23, 59),
    },
    {
      message: 'The hands-on ultrasound workshop has limited seats and is filling quickly.',
      level: 'info',
      isActive: true,
      publishedAt: new Date(),
      expiresAt: null,
    },
  ],

  contact: {
    name: 'CIIM 2026 Conference Secretariat',
    phone: '+914442279999',
    whatsapp: '+919840012345',
    email: 'secretariat@ciim2026.com',
  },

  seo: {
    metaTitle: 'CIIM 2026 | Controversies in Infertility Management',
    metaDescription:
      '5th Annual Conference on Controversies in Infertility Management, 21–22 Nov 2026 at The Leela Palace, Chennai. Register now.',
    keywords: [
      'CIIM 2026',
      'infertility conference chennai',
      'IVF conference india',
      'controversies in infertility management',
      'prashanth fertility',
    ],
    ogImageUrl: '/assets/og-summit-2026.jpg',
    noIndex: false,
  },

  theme: {
    primaryColor: '#96291F',
    accentColor: '#96291F',
    heroImageUrl: '',
    logoUrl: '/assets/prashanth-hospitals-crest.jpg',
  },

  isFeatured: true,
};

const ticketTypesData = [
  {
    name: 'Delegate — Regular',
    code: 'REG',
    description: 'Full-day access to all main hall sessions, delegate kit, lunch and certificate.',
    kind: 'paid',
    price: 2500,
    taxPercent: 18,
    admitsCount: 1,
    quantityTotal: 250,
    quantitySold: 118,
    minPerOrder: 1,
    maxPerOrder: 5,
    benefits: [
      'Access to all main hall sessions',
      'Delegate kit and printed programme',
      'Lunch and high tea',
      '6 CME credit points',
      'E-certificate of participation',
    ],
    isPubliclyVisible: true,
    isActive: true,
    order: 1,
  },
  {
    name: 'PG Student / Resident',
    code: 'PGS',
    description: 'Concessional pass for postgraduates. Valid institutional ID required at check-in.',
    kind: 'paid',
    price: 1200,
    taxPercent: 18,
    admitsCount: 1,
    quantityTotal: 80,
    quantitySold: 44,
    minPerOrder: 1,
    maxPerOrder: 2,
    benefits: [
      'Access to all main hall sessions',
      'Delegate kit',
      'Lunch and high tea',
      'E-certificate of participation',
    ],
    allowedParticipantTypes: ['PG Student', 'Resident'],
    isPubliclyVisible: true,
    isActive: true,
    order: 2,
  },
  {
    name: 'Duo Pass (2 Delegates)',
    code: 'CPL',
    description: 'One registration admitting two delegates. Each receives an individual QR ticket.',
    kind: 'couple',
    price: 4500,
    taxPercent: 18,
    admitsCount: 2,
    quantityTotal: 60,
    quantitySold: 12,
    minPerOrder: 1,
    maxPerOrder: 3,
    benefits: [
      'Admits two delegates',
      'Two delegate kits and two certificates',
      'Reserved seating block',
      'Lunch and high tea for both',
    ],
    isPubliclyVisible: true,
    isActive: true,
    order: 3,
  },
  {
    name: 'VIP + Hands-on Workshop',
    code: 'VIP',
    description:
      'Includes the limited-capacity ultrasound skills workshop and faculty networking dinner.',
    kind: 'vip',
    price: 6500,
    taxPercent: 18,
    admitsCount: 1,
    quantityTotal: 40,
    quantitySold: 33,
    minPerOrder: 1,
    maxPerOrder: 2,
    benefits: [
      'Everything in the Regular pass',
      'Seat in the hands-on ultrasound workshop',
      'Front-row reserved seating',
      'Faculty networking dinner',
      'Printed session resource compendium',
    ],
    isPubliclyVisible: true,
    isActive: true,
    order: 4,
  },
  {
    name: 'Invited Faculty / Complimentary',
    code: 'COMP',
    description: 'Issued by the organising committee. Not available for public purchase.',
    kind: 'complimentary',
    price: 0,
    admitsCount: 1,
    quantityTotal: 30,
    quantitySold: 18,
    benefits: ['Full access', 'Faculty lounge', 'Networking dinner'],
    isPubliclyVisible: false,
    isActive: true,
    order: 5,
  },
];

async function seed() {
  await connectDatabase();

  // Load-then-save (rather than findOneAndUpdate) so document middleware and
  // validators run: slug derivation, publishedAt, and the date-order checks.
  let event = await Event.findOne({ slug: SLUG });
  if (!event) {
    event = new Event(eventData);
  } else {
    event.set(eventData);
  }
  await event.save();

  logger.info(`Seeded event: ${event.title} (${event.slug})`);

  for (const ticket of ticketTypesData) {
    let doc = await TicketType.findOne({ event: event._id, code: ticket.code });
    if (!doc) {
      doc = new TicketType({ ...ticket, event: event._id });
    } else {
      doc.set({ ...ticket, event: event._id });
    }
    await doc.save();
  }

  logger.info(`Seeded ${ticketTypesData.length} ticket types`);
  logger.info(`Microsite URL: /events/${event.slug}`);

  await disconnectDatabase();
}

seed().catch(async (err) => {
  logger.error('Seeding failed', err);
  try {
    await disconnectDatabase();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
