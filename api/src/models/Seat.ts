import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type SeatStatus = 'available' | 'locked' | 'booked';

export interface ISeat extends Document {
  eventId: Types.ObjectId;
  row: string;
  col: number;
  seatNumber: string;
  status: SeatStatus;
  lockedBy: Types.ObjectId | null;
  lockedUntil: Date | null;
  bookedBy: Types.ObjectId | null;
  bookedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const SeatSchema: Schema<ISeat> = new Schema(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    row: {
      type: String,
      required: true,
      trim: true,
    },
    col: {
      type: Number,
      required: true,
    },
    seatNumber: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['available', 'locked', 'booked'],
      default: 'available',
      index: true,
    },
    lockedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    lockedUntil: {
      type: Date,
      default: null,
      index: true,
    },
    bookedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    bookedAt: {
      type: Date,
      default: null,
    },
    version: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring no duplicate seat coordinates in the same event
SeatSchema.index({ eventId: 1, row: 1, col: 1 }, { unique: true });
SeatSchema.index({ eventId: 1, seatNumber: 1 }, { unique: true });

export const Seat: Model<ISeat> = mongoose.models.Seat || mongoose.model<ISeat>('Seat', SeatSchema);
