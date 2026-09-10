import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>US</Text>
      <Text style={styles.subtitle}>Project skeleton ready</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 64,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 12,
    fontSize: 16,
    opacity: 0.6,
  },
});
