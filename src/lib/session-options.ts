import { SessionOptions } from 'iron-session';

const sessionPassword =
  process.env.SESSION_SECRET || 'test-secret';

export const sessionOptions: SessionOptions = {
  password: sessionPassword,
  cookieName: 'iron-session/examples/next.js',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
};
