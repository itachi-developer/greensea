import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { View, ActivityIndicator, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ParadoxScreen from '../screens/ParadoxScreen';
import TurbineScreen from '../screens/TurbineScreen';
import ChatHubScreen from '../screens/ChatHubScreen'; 
import PrivateChatScreen from '../screens/PrivateChatScreen'; 
import GroupChatScreen from '../screens/GroupChatScreen'; 
import UsersDirectoryScreen from '../screens/UsersDirectoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ArcadeScreen from '../screens/ArcadeScreen';
import SimonDigitalScreen from '../screens/SimonDigitalScreen';
import GravityRunnerScreen from '../screens/GravityRunnerScreen';
import ChuteTapScreen from '../screens/ChuteTapScreen';
import WallBounceScreen from '../screens/WallBounceScreen';
import VisualCounterScreen from '../screens/VisualCounterScreen';
import StroopTestScreen from '../screens/StroopTestScreen';
import Dominio15Screen from '../screens/Dominio15Screen';
import SpectatorMatchScreen from '../screens/SpectatorMatchScreen';
import PartyLobbyScreen from '../screens/PartyLobbyScreen';
import DeceptionGameScreen from '../screens/DeceptionGameScreen';
import GameRulesScreen from '../screens/GameRulesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import HolonetFeedScreen from '../screens/HolonetFeedScreen';
import WarRoomGamesScreen from '../screens/WarRoomGamesScreen';
import PongScreen from '../screens/PongScreen';
import TowerStackScreen from '../screens/TowerStackScreen';
import StopTheClockScreen from '../screens/StopTheClockScreen';
import ShapeSmistScreen from '../screens/ShapeSmistScreen';
import RoomHubScreen from '../screens/RoomHubScreen';
import RoomDetailScreen from '../screens/RoomDetailScreen';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Profile: undefined; // <-- Aggiunto
  WarRoomGames: undefined; // <-- Aggiunto
  Chat: undefined; // <-- Aggiunto
  RoomHub: undefined;
  RoomDetail: { roomId: string };
  Holonet: undefined;
  Paradox: undefined;
  Turbine: { multiplier: number };
  PrivateChat: { roomId: string; userName: string };
  GroupChat: { roomId: string; groupName: string };
  UsersDirectory: undefined;
  Settings: undefined;
  Arcade: undefined;
  ColorMatch: undefined;
  ColorMatchPreGame: undefined;
  SimonDigital: { isRoomMode?: boolean; roomId?: string; playDate?: string } | undefined;
  GravityRunner: { isRoomMode?: boolean; roomId?: string; playDate?: string } | undefined;
  ChuteTap: { isRoomMode?: boolean; roomId?: string; playDate?: string } | undefined;
  WallBounce: { isRoomMode?: boolean; roomId?: string; playDate?: string } | undefined;
  MathFall: undefined;
  VisualCounter: { isRoomMode?: boolean; roomId?: string; playDate?: string } | undefined;
  StroopTest: { isRoomMode?: boolean; roomId?: string; playDate?: string } | undefined;
  Dominio15: { isRoomMode?: boolean; roomId?: string; playDate?: string } | undefined;
  SpectatorMatch: { matchId?: string };
  PartyLobby: undefined;
  DeceptionGame: { roomId: string; userId: string };
  GameRules: undefined;
  Pong3D: { isRoomMode?: boolean; roomId?: string; playDate?: string } | undefined;
  TowerStack: { isRoomMode?: boolean; roomId?: string; playDate?: string } | undefined;
  StopTheClock: { isRoomMode?: boolean; roomId?: string; playDate?: string } | undefined;
  ShapeSmist: { isRoomMode?: boolean; roomId?: string; playDate?: string } | undefined;
  WarRoom: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

async function registerForPushNotificationsAsync(userId: string) {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00E5FF',
    });
  }

  if (!Device.isDevice) {
    console.log('Must use physical device for Push Notifications');
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Failed to get push token for push notification!');
    return;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const pushToken = tokenData.data;

    // Save token in Supabase profiles table
    await supabase
      .from('profiles')
      .update({ push_token: pushToken })
      .eq('id', userId);
  } catch (error) {
    console.error('Error getting or saving push token:', error);
  }
}

export default function AppNavigator() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session?.user) {
        registerForPushNotificationsAsync(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        registerForPushNotificationsAsync(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A192F', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#00E5FF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {!session ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          <Stack.Group screenOptions={{ headerShown: false }}>
            {/* Schermata iniziale post-login */}
            <Stack.Screen name="Profile" component={ProfileScreen} />
            
            {/* Hub Principali */}
            <Stack.Screen name="WarRoomGames" component={WarRoomGamesScreen} />
            <Stack.Screen name="Chat" component={ChatHubScreen} />
            <Stack.Screen name="Holonet" component={HolonetFeedScreen} />
            <Stack.Screen name="RoomHub" component={RoomHubScreen} />
            <Stack.Screen name="RoomDetail" component={RoomDetailScreen} />
            
            {/* Tutte le altre schermate */}
            <Stack.Screen name="Paradox" component={ParadoxScreen} />
            <Stack.Screen name="Turbine" component={TurbineScreen} />
            <Stack.Screen name="PrivateChat" component={PrivateChatScreen} />
            <Stack.Screen name="GroupChat" component={GroupChatScreen} />
            <Stack.Screen name="UsersDirectory" component={UsersDirectoryScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Arcade" component={ArcadeScreen} />
            <Stack.Screen name="SimonDigital" component={SimonDigitalScreen} />
            <Stack.Screen name="GravityRunner" component={GravityRunnerScreen} />
            <Stack.Screen name="ChuteTap" component={ChuteTapScreen} />
            <Stack.Screen name="WallBounce" component={WallBounceScreen} />
            <Stack.Screen name="VisualCounter" component={VisualCounterScreen} />
            <Stack.Screen name="StroopTest" component={StroopTestScreen} />
            <Stack.Screen name="Dominio15" component={Dominio15Screen} />
            <Stack.Screen name="SpectatorMatch" component={SpectatorMatchScreen} />
            <Stack.Screen name="PartyLobby" component={PartyLobbyScreen} />
            <Stack.Screen name="DeceptionGame" component={DeceptionGameScreen} />
            <Stack.Screen name="GameRules" component={GameRulesScreen} />
            <Stack.Screen name="Pong3D" component={PongScreen} />
            <Stack.Screen name="TowerStack" component={TowerStackScreen} />
            <Stack.Screen name="StopTheClock" component={StopTheClockScreen} />
            <Stack.Screen name="ShapeSmist" component={ShapeSmistScreen} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}