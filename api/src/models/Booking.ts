import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type BookingStatus = 'confirmed' | 'cancelled';

export interface IBooking extends Document {
  bookingRef: string;
  eventId: Types.ObjectId;
  seatId: Types.ObjectId;
  userId: Types.ObjectId;
  amount: number;
  status: BookingStatus;
  strategyUsed: string; // 'naive' | 'mongo-atomic' | 'redis-lock'
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema: Schema<IBooking> = new Schema(
  {
    bookingRef: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    seatId: {
      type: Schema.Types.ObjectId,
      ref: 'Seat',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['confirmed', 'cancelled'],
      default: 'confirmed',
      index: true,
    },
    strategyUsed: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce unique invariant: In safe modes (anything other than 'naive'), a seat can never have two confirmed bookings.
BookingSchema.index(
  { eventId: 1, seatId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      strategyUsed: { $in: ['mongo-atomic', 'redis-lock'] },
      status: 'confirmed',
    },
  }
);

export const Booking: Model<IBooking> = mongoose.models.Booking || mongoose.model<IBooking>('Booking', BookingSchema);
