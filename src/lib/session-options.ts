import { SessionOptions } from 'iron-session';

const sessionPassword = process.env.SESSION_SECRET;

if (!sessionPassword) {
  throw new Error("SESSION_SECRET must be set to ensure secure sessions.");
}

export const sessionOptions: SessionOptions = {
  password: sessionPassword,
  cookieName: 'iron-session/examples/next.js',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
};
