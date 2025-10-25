import mongoose from 'mongoose';

const { Schema } = mongoose;

const RefreshTokenSchema = new Schema({
  tokenHash: { type: String, required: true, unique: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  expiresAt: { type: Date, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
  revokedAt: { type: Date, default: null }
});

// TTL index: auto-remove when expiresAt is in the past
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshToken = mongoose.models.RefreshToken || mongoose.model('RefreshToken', RefreshTokenSchema);

export default RefreshToken;
