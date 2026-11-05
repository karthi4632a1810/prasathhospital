'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const QuestionItemSchema = new Schema(
  {
    topic: {
      type: String,
      trim: true,
      default: 'General / CME Question',
      maxlength: 120,
    },
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    targetFaculty: {
      type: String,
      trim: true,
      default: 'Organising Committee of CME',
      maxlength: 120,
    },
    clinicalCase: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2000,
    },
  },
  { _id: true, timestamps: true }
);

/**
 * Questions submitted by attending doctors/delegates for panel discussions
 * across the 5 conference focus topics at CIIM 2026.
 */
const TopicQuestionSchema = new Schema(
  {
    event: { type: Schema.Types.ObjectId, ref: 'Event', index: true },

    doctorName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 150,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    hospital: {
      type: String,
      trim: true,
      default: '',
      maxlength: 200,
    },
    city: {
      type: String,
      trim: true,
      default: '',
      maxlength: 100,
    },
    delegateId: {
      type: String,
      trim: true,
      default: '',
      maxlength: 50,
    },

    questions: {
      type: [QuestionItemSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'At least one question is required.',
      },
    },

    status: {
      type: String,
      enum: ['pending', 'shortlisted', 'addressed', 'archived'],
      default: 'pending',
      index: true,
    },

    moderatorNotes: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TopicQuestion', TopicQuestionSchema);

