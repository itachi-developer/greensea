import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function ParadoxScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Paradox Screen</Text>
      <Text style={styles.subtitle}>Contenuto del paradosso in arrivo...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
  },
});
