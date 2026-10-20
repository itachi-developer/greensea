import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home Screen</Text>
      
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('Paradox')}
      >
        <Text style={styles.buttonText}>Vai a Paradox</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.chatButton]}
        onPress={() => navigation.navigate('GlobalChat')}
      >
        <Text style={styles.buttonText}>Vai a Global Chat</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 32,
    color: '#1a1a1a',
  },
  button: {
    width: '100%',
    paddingVertical: 14,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  chatButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
