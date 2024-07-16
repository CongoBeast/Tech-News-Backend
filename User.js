const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  userType: { type: String, enum: ['regular', 'super'], default: 'regular' },
  signupTimestamp: { type: Date, default: Date.now },
  loginTimestamp: { type: Date },
  isLoggedIn: { type: Boolean, default: false },
});

const User = mongoose.model('users', userSchema);

module.exports = User;
