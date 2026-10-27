import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEvent extends Document {
  title: string;
  description: string;
  venue: string;
  date: Date;
  rows: number;
  cols: number;
  totalSeats: number;
  price: number;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema: Schema<IEvent> = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    venue: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    rows: {
      type: Number,
      required: true,
      min: 1,
    },
    cols: {
      type: Number,
      required: true,
      min: 1,
    },
    totalSeats: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      default: 50,
    },
  },
  {
    timestamps: true,
  }
);

export const Event: Model<IEvent> = mongoose.models.Event || mongoose.model<IEvent>('Event', EventSchema);
