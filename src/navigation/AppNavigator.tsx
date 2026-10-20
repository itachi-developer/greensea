import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import ParadoxScreen from '../screens/ParadoxScreen';
import GlobalChatScreen from '../screens/GlobalChatScreen';

export type RootStackParamList = {
  Home: undefined;
  Paradox: undefined;
  GlobalChat: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#007AFF',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Home' }}
      />
      <Stack.Screen
        name="Paradox"
        component={ParadoxScreen}
        options={{ title: 'Paradox' }}
      />
      <Stack.Screen
        name="GlobalChat"
        component={GlobalChatScreen}
        options={{ title: 'Global Chat' }}
      />
    </Stack.Navigator>
  );
}
