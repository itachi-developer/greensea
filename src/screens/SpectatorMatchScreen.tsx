import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, TextInput, FlatList, Animated, Dimensions, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

/*
  === SUPABASE SQL SCHEMA FOR PHASE 3 (Spectator & Betting) ===
  
  CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_red_id UUID REFERENCES auth.users(id),
    player_blue_id UUID REFERENCES auth.users(id),
    status TEXT DEFAULT 'live', -- 'live', 'finished'
    winner TEXT, -- 'red', 'blue'
    board JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
  );

  CREATE TABLE bets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    predicted_winner TEXT NOT NULL, -- 'red', 'blue'
    amount INTEGER NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'won', 'lost'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
  );

  CREATE TABLE spectator_chat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
  );
*/

const { width } = Dimensions.get('window');

interface FloatingEmote {
  id: string;
  emoji: string;
  xAnim: Animated.Value;
  yAnim: Animated.Value;
}

export default function SpectatorMatchScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const matchId = route.params?.matchId || 'mock_match_123';

  const [matchData, setMatchData] = useState({
    redName: 'VoidMaster',
    blueName: 'NeonCyber',
    redScore: 7,
    blueScore: 8,
    status: 'LIVE'
  });

  const [betSide, setBetSide] = useState<'red' | 'blue' | null>(null);
  const [betAmount, setBetAmount] = useState('50');
  const [hasPlacedBet, setHasPlacedBet] = useState(false);

  const [chatMessages, setChatMessages] = useState([
    { id: '1', user: 'CyberFan99', text: 'Forza Blu!' },
    { id: '2', user: 'RedLegend', text: 'Il rosso domina questa griglia' },
    { id: '3', user: 'ArenaWatcher', text: 'Che mossa incredibile!' },
  ]);
  const [inputMessage, setInputMessage] = useState('');

  const [floatingEmotes, setFloatingEmotes] = useState<FloatingEmote[]>([]);

  // Simulate incoming floating spectator emotes
  useEffect(() => {
    const interval = setInterval(() => {
      const emojis = ['🔥', '👏', '🚀', '⚡', '👑'];
      const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
      
      const newEmote: FloatingEmote = {
        id: Math.random().toString(36).substring(7),
        emoji: randomEmoji,
        xAnim: new Animated.Value(Math.random() * (width - 100) + 50),
        yAnim: new Animated.Value(300),
      };

      setFloatingEmotes(prev => [...prev, newEmote]);

      Animated.timing(newEmote.yAnim, {
        toValue: 50,
        duration: 2500,
        useNativeDriver: true,
      }).start(() => {
        setFloatingEmotes(prev => prev.filter(e => e.id !== newEmote.id));
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const placeBet = async () => {
    if (!betSide) {
      Alert.alert("Scommessa", "Seleziona quale fazione vuoi supportare (Rosso o Blu).");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Inserimento scommessa su Supabase (tabella bets)
      await supabase.from('bets').insert({
        match_id: matchId,
        user_id: user.id,
        predicted_winner: betSide,
        amount: parseInt(betAmount, 10) || 50
      });
    }

    setHasPlacedBet(true);
    Alert.alert("Scommessa Piazzata!", `Hai puntato ${betAmount} Ticket Arena sulla vittoria di ${betSide.toUpperCase()}!`);
  };

  const sendChatMessage = async () => {
    if (!inputMessage.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('spectator_chat').insert({
        match_id: matchId,
        user_id: user.id,
        message: inputMessage
      });
    }

    setChatMessages(prev => [...prev, { id: Date.now().toString(), user: 'Tu', text: inputMessage }]);
    setInputMessage('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#00F0FF" />
          </TouchableOpacity>
          <Text style={styles.title}>MODALITÀ SPETTATORE & BETTING</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {/* Match Arena Header */}
        <View style={styles.matchCard}>
          <View style={styles.playerInfo}>
            <Text style={[styles.playerLabel, { color: '#FF2A2A' }]}>{matchData.redName}</Text>
            <Text style={styles.scoreNum}>{matchData.redScore}</Text>
          </View>
          <Text style={styles.vsText}>VS</Text>
          <View style={styles.playerInfo}>
            <Text style={styles.scoreNum}>{matchData.blueScore}</Text>
            <Text style={[styles.playerLabel, { color: '#00F0FF' }]}>{matchData.blueName}</Text>
          </View>
        </View>

        {/* Floating Emotes Layer */}
        <View style={styles.floatingLayer} pointerEvents="none">
          {floatingEmotes.map(fe => (
            <Animated.Text
              key={fe.id}
              style={[
                styles.floatingEmoji,
                {
                  transform: [{ translateX: fe.xAnim }, { translateY: fe.yAnim }]
                }
              ]}
            >
              {fe.emoji}
            </Animated.Text>
          ))}
        </View>

        {/* Betting Panel */}
        <View style={styles.bettingBox}>
          <Text style={styles.sectionTitle}>SCOMMETTI SUL MATCH (TICKET ARENA)</Text>
          {!hasPlacedBet ? (
            <View style={styles.betControls}>
              <View style={styles.betSideRow}>
                <TouchableOpacity
                  style={[styles.sideBtn, betSide === 'red' && styles.sideRedActive]}
                  onPress={() => setBetSide('red')}
                >
                  <Text style={styles.sideBtnText}>Vince ROSSO</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sideBtn, betSide === 'blue' && styles.sideBlueActive]}
                  onPress={() => setBetSide('blue')}
                >
                  <Text style={styles.sideBtnText}>Vince BLU</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.amountRow}>
                <TextInput
                  style={styles.inputAmount}
                  value={betAmount}
                  onChangeText={setBetAmount}
                  keyboardType="numeric"
                  placeholder="Ticket"
                  placeholderTextColor="#4A5578"
                />
                <TouchableOpacity style={styles.confirmBetBtn} onPress={placeBet}>
                  <Text style={styles.confirmBetText}>CONFERMA SCOMMESSA</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={styles.betPlacedText}>Scommessa attiva: {betAmount} Ticket su {betSide?.toUpperCase()}</Text>
          )}
        </View>

        {/* Live Spectator Chat */}
        <View style={styles.chatBox}>
          <Text style={styles.sectionTitle}>LIVE CHAT SPETTATORI</Text>
          <FlatList
            data={chatMessages}
            keyExtractor={item => item.id}
            style={styles.chatList}
            renderItem={({ item }) => (
              <View style={styles.chatRow}>
                <Text style={styles.chatUser}>{item.user}:</Text>
                <Text style={styles.chatText}>{item.text}</Text>
              </View>
            )}
          />
          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatInput}
              value={inputMessage}
              onChangeText={setInputMessage}
              placeholder="Invia un messaggio di tifo..."
              placeholderTextColor="#4A5578"
            />
            <TouchableOpacity style={styles.sendBtn} onPress={sendChatMessage}>
              <Ionicons name="send" size={18} color="#090B14" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#070913' },
  container: { flex: 1, padding: 16, justifyContent: 'space-between' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#00F0FF1A', justifyContent: 'center', alignItems: 'center' },
  title: { color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF005526', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#FF0055' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF0055', marginRight: 6 },
  liveText: { color: '#FF0055', fontSize: 11, fontWeight: '900' },

  matchCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#121624', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#1E2538', marginBottom: 12 },
  playerInfo: { alignItems: 'center' },
  playerLabel: { fontSize: 13, fontWeight: '900', marginBottom: 4 },
  scoreNum: { color: '#FFF', fontSize: 24, fontWeight: '900' },
  vsText: { color: '#8A93B0', fontSize: 14, fontWeight: '900' },

  floatingLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 },
  floatingEmoji: { position: 'absolute', fontSize: 28 },

  bettingBox: { backgroundColor: '#121624', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#1E2538', marginBottom: 12 },
  sectionTitle: { color: '#8A93B0', fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8 },
  betControls: { gap: 8 },
  betSideRow: { flexDirection: 'row', gap: 10 },
  sideBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: '#1A1F35', borderWidth: 1, borderColor: '#1E2538' },
  sideRedActive: { backgroundColor: '#FF2A2A26', borderColor: '#FF2A2A' },
  sideBlueActive: { backgroundColor: '#00F0FF26', borderColor: '#00F0FF' },
  sideBtnText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  amountRow: { flexDirection: 'row', gap: 10 },
  inputAmount: { flex: 1, backgroundColor: '#090B14', borderRadius: 8, paddingHorizontal: 12, color: '#FFF', borderWidth: 1, borderColor: '#1E2538', height: 40, fontWeight: '800' },
  confirmBetBtn: { backgroundColor: '#39FF14', paddingHorizontal: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', height: 40 },
  confirmBetText: { color: '#090B14', fontSize: 12, fontWeight: '900' },
  betPlacedText: { color: '#39FF14', fontSize: 13, fontWeight: '900', textAlign: 'center', paddingVertical: 8 },

  chatBox: { flex: 1, backgroundColor: '#121624', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#1E2538' },
  chatList: { flex: 1, marginBottom: 8 },
  chatRow: { flexDirection: 'row', marginBottom: 6 },
  chatUser: { color: '#00F0FF', fontSize: 12, fontWeight: '900', marginRight: 6 },
  chatText: { color: '#E0E6ED', fontSize: 12, fontWeight: '600', flex: 1 },
  chatInputRow: { flexDirection: 'row', gap: 8 },
  chatInput: { flex: 1, backgroundColor: '#090B14', borderRadius: 8, paddingHorizontal: 12, color: '#FFF', borderWidth: 1, borderColor: '#1E2538', height: 40, fontSize: 12 },
  sendBtn: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#39FF14', justifyContent: 'center', alignItems: 'center' }
});
