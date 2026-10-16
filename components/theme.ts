import { StyleSheet } from 'react-native';

// Warm editorial palette: plum and coral on cream. One accent per surface.
export const c = {
  ink: '#2A1D2C',
  inkSoft: '#5C4A5D',
  plum: '#70445F',
  plumDeep: '#4D2C41',
  coral: '#D7675A',
  coralWash: '#FBEDEA',
  blush: '#F4D8D1',
  paper: '#FFFDF8',
  cream: '#F8F2EA',
  muted: '#8D7D85',
  line: '#E9DDD8',
  sage: '#D8E6D9',
  sageDeep: '#579466',
  white: '#FFFFFF',
};

// 4pt spacing scale.
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 30 };

export const radius = { sm: 10, md: 14, lg: 18, xl: 26, pill: 999 };

export const shadow = {
  soft: {
    shadowColor: c.ink,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  lifted: {
    shadowColor: c.ink,
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
};

export const s = StyleSheet.create({
  // Layout
  screen: { flex: 1, backgroundColor: c.cream },
  content: { padding: space.xl, paddingBottom: space.xxl },
  fill: { flex: 1 },

  // Type
  eyebrow: { color: c.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  label: { color: c.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: space.sm, marginTop: space.xl },
  display: { color: c.ink, fontFamily: 'Georgia', fontSize: 38, lineHeight: 45 },
  title: { color: c.ink, fontFamily: 'Georgia', fontSize: 34, lineHeight: 41, marginTop: 7 },
  heading: { color: c.ink, fontFamily: 'Georgia', fontSize: 21, lineHeight: 27 },
  body: { color: c.muted, fontSize: 15, lineHeight: 22 },
  bodyStrong: { color: c.ink, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  caption: { color: c.muted, fontSize: 12, lineHeight: 17 },

  // Surfaces
  card: {
    backgroundColor: c.paper,
    borderColor: c.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.lg,
  },
  primary: {
    alignItems: 'center',
    backgroundColor: c.plum,
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryText: { color: c.white, fontSize: 15, fontWeight: '800' },
  input: {
    backgroundColor: c.paper,
    borderColor: c.line,
    borderRadius: radius.md,
    borderWidth: 1,
    color: c.ink,
    fontSize: 16,
    minHeight: 52,
    padding: space.lg,
  },
});
