import { SessionOptions } from 'iron-session';

const sessionPassword =
  process.env.SESSION_SECRET || 'test-secret-development-key-that-is-32-bytes-long';

export const sessionOptions: SessionOptions = {
  password: sessionPassword,
  cookieName: 'iron-session/examples/next.js',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
};
