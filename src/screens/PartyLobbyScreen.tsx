import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

const GAME_MODES = [
  { id: 'deception', title: 'CLASSIC PARTY PROTOCOL', desc: 'Il classico gioco di bluff e verità.', color: '#00E5FF', icon: 'shield' },
  { id: 'naughty_fakin', title: "FAKIN' IT ALL NIGHT LONG", desc: 'Confessioni intime e indicazioni personali.', color: '#FF0055', icon: 'flame' },
  { id: 'naughty_drawful', title: 'DIRTY DRAWFUL', desc: 'Disegni vietati ai minori e fraintendimenti.', color: '#B026FF', icon: 'brush' },
  { id: 'naughty_finish', title: 'LET ME FINISH', desc: 'Presentazioni assurde e tesi a luci rosse.', color: '#39FF14', icon: 'chatbubbles' },
];

export default function PartyLobbyScreen() {
  const navigation = useNavigation<any>();
  const [user, setUser] = useState<any>(null);
  const [nickname, setNickname] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [currentRoom, setCurrentRoom] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentGameMode, setCurrentGameMode] = useState('deception');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser(user);
        const defaultNick = user.email ? user.email.split('@')[0].toUpperCase() : 'CYBER_AGENT';
        setNickname(defaultNick);
      }
    });
  }, []);

  // Supabase Realtime subscription for room and players
  useEffect(() => {
    if (!currentRoom) return;

    const channel = supabase
      .channel(`party-room-${currentRoom.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'party_players',
          filter: `room_id=eq.${currentRoom.id}`,
        },
        async () => {
          fetchPlayers(currentRoom.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'party_rooms',
          filter: `id=eq.${currentRoom.id}`,
        },
        (payload: any) => {
          const updatedRoom = payload.new;
          setCurrentRoom(updatedRoom);
          if (updatedRoom.current_game) {
            setCurrentGameMode(updatedRoom.current_game);
          }
          if (updatedRoom.status === 'playing') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            navigation.replace('DeceptionGame', { roomId: updatedRoom.id, userId: user?.id, gameMode: updatedRoom.current_game });
          }
        }
      )
      .subscribe();

    fetchPlayers(currentRoom.id);

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRoom]);

  const fetchPlayers = async (roomId: string) => {
    const { data, error } = await supabase
      .from('party_players')
      .select('*')
      .eq('room_id', roomId);
    if (!error && data) {
      setPlayers(data);
    }
  };

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateRoom = async () => {
    if (!user) return;
    if (!nickname.trim()) {
      setErrorMessage('Inserisci un nickname valido');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const roomCode = generateRoomCode();

    // 1. Create room
    const { data: roomData, error: roomError } = await supabase
      .from('party_rooms')
      .insert({
        room_code: roomCode,
        host_id: user.id,
        status: 'lobby',
        current_game: currentGameMode,
      })
      .select()
      .single();

    if (roomError || !roomData) {
      setErrorMessage('Errore creazione stanza: ' + (roomError?.message || 'Sconosciuto'));
      setLoading(false);
      return;
    }

    // 2. Insert host as player
    const { error: playerError } = await supabase.from('party_players').insert({
      room_id: roomData.id,
      user_id: user.id,
      nickname: nickname.toUpperCase().trim(),
      is_host: true,
      is_ready: true,
    });

    if (playerError) {
      setErrorMessage('Errore inserimento giocatore: ' + playerError.message);
      setLoading(false);
      return;
    }

    setIsHost(true);
    setCurrentRoom(roomData);
    setLoading(false);
  };

  const handleJoinRoom = async () => {
    if (!user) return;
    if (!nickname.trim()) {
      setErrorMessage('Inserisci un nickname valido');
      return;
    }
    if (roomCodeInput.trim().length !== 4) {
      setErrorMessage('Il codice stanza deve essere di 4 lettere');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const cleanCode = roomCodeInput.toUpperCase().trim();

    // 1. Find room
    const { data: roomData, error: roomError } = await supabase
      .from('party_rooms')
      .select('*')
      .eq('room_code', cleanCode)
      .single();

    if (roomError || !roomData) {
      setErrorMessage('Stanza non trovata con codice: ' + cleanCode);
      setLoading(false);
      return;
    }

    if (roomData.status !== 'lobby') {
      setErrorMessage('La partita è già iniziata o terminata.');
      setLoading(false);
      return;
    }

    const { count } = await supabase
      .from('party_players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomData.id);

    if (count !== null && count >= 8) {
      setErrorMessage('Stanza piena (massimo 8 giocatori).');
      setLoading(false);
      return;
    }

    // 2. Insert player
    const { error: playerError } = await supabase.from('party_players').upsert({
      room_id: roomData.id,
      user_id: user.id,
      nickname: nickname.toUpperCase().trim(),
      is_host: false,
      is_ready: false,
    }, { onConflict: 'room_id,user_id' });

    if (playerError) {
      setErrorMessage('Errore accesso stanza: ' + playerError.message);
      setLoading(false);
      return;
    }

    setIsHost(false);
    setCurrentRoom(roomData);
    if (roomData.current_game) {
      setCurrentGameMode(roomData.current_game);
    }
    setLoading(false);
  };

  const handleSelectGameMode = async (gameId: string) => {
    if (!isHost || !currentRoom) return;
    setCurrentGameMode(gameId);
    Haptics.selectionAsync();

    await supabase
      .from('party_rooms')
      .update({ current_game: gameId })
      .eq('id', currentRoom.id);
  };

  const handleStartProtocol = async () => {
    if (!currentRoom || !isHost) return;
    if (players.length < 3) {
      Alert.alert('Protocollo Insufficiente', 'Servono almeno 3 giocatori per avviare il Party Protocol.');
      return;
    }

    setLoading(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    // Determine target table based on currentGameMode
    let tableName = 'party_prompts';
    if (currentGameMode === 'naughty_fakin') tableName = 'naughty_fakin_prompts';
    else if (currentGameMode === 'naughty_drawful') tableName = 'naughty_drawful_prompts';
    else if (currentGameMode === 'naughty_finish') tableName = 'naughty_finish_prompts';

    const { data: promptsData, error: promptError } = await supabase
      .from(tableName)
      .select('*');

    if (promptError || !promptsData || promptsData.length === 0) {
      Alert.alert('Errore', `Impossibile caricare i prompt dalla tabella ${tableName}: ` + (promptError?.message || 'Nessun prompt'));
      setLoading(false);
      return;
    }

    // Normalize prompt text field across different tables
    const normalizedPrompts = promptsData.map((p: any) => ({
      id: p.id,
      text: p.prompt_text || p.text || p.statement || p.question || 'Prompt sconosciuto',
      truth: p.truth || p.answer || p.correct_answer || 'Segreto di Stato'
    }));

    // Shuffle and pick 10 unique prompts for the full 10-round game
    const shuffled = [...normalizedPrompts].sort(() => Math.random() - 0.5);
    const selectedPrompts = shuffled.slice(0, 10);
    const firstPrompt = selectedPrompts[0];

    // Initialize initial game state
    await supabase.from('party_game_state').upsert({
      room_id: currentRoom.id,
      round_number: 1,
      game_phase: 'bluffing',
      current_prompt: firstPrompt,
      selected_prompts: selectedPrompts,
      submissions: {},
      votes: {},
      choices: []
    });

    const { error } = await supabase
      .from('party_rooms')
      .update({ status: 'playing' })
      .eq('id', currentRoom.id);

    if (error) {
      Alert.alert('Errore', 'Impossibile avviare il protocollo: ' + error.message);
      setLoading(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!currentRoom || !user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    await supabase
      .from('party_players')
      .delete()
      .eq('room_id', currentRoom.id)
      .eq('user_id', user.id);

    if (isHost) {
      await supabase.from('party_rooms').delete().eq('id', currentRoom.id);
    }

    setCurrentRoom(null);
    setPlayers([]);
    setIsHost(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#00E5FF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>JACKBOX NAUGHTY PACK</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {!currentRoom ? (
          <ScrollView contentContainerStyle={styles.lobbyFormContainer} showsVerticalScrollIndicator={false}>
            <LinearGradient colors={['#121624', '#050B14']} style={styles.cardGlass}>
              <Text style={styles.cardTitle}>ACCESSO AL PROTOCOLLO</Text>

              {errorMessage && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={18} color="#FF0055" />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              <Text style={styles.inputLabel}>NICKNAME CYBER</Text>
              <TextInput
                style={styles.input}
                placeholder="Inserisci il tuo Nickname"
                placeholderTextColor="#8892B0"
                value={nickname}
                onChangeText={setNickname}
                maxLength={20}
              />

              <Text style={[styles.inputLabel, { marginTop: 10 }]}>SELEZIONA MODALITÀ (NAUGHTY PACK)</Text>
              <View style={styles.gameModesGrid}>
                {GAME_MODES.map((mode) => (
                  <TouchableOpacity
                    key={mode.id}
                    style={[styles.gameModeCard, currentGameMode === mode.id && { borderColor: mode.color, backgroundColor: 'rgba(0, 229, 255, 0.08)' }]}
                    onPress={() => setCurrentGameMode(mode.id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={mode.icon as any} size={20} color={mode.color} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.gameModeTitle}>{mode.title}</Text>
                      <Text style={styles.gameModeDesc} numberOfLines={1}>{mode.desc}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleCreateRoom}
                disabled={loading}
              >
                <LinearGradient colors={['#00E5FF', '#20C997']} style={styles.gradientBtn}>
                  <Ionicons name="add-circle" size={20} color="#050B14" />
                  <Text style={styles.actionBtnText}>CREA STANZA NAUGHTY PACK</Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.line} />
                <Text style={styles.dividerText}>OPPURE UNISCITI</Text>
                <View style={styles.line} />
              </View>

              <Text style={styles.inputLabel}>CODICE STANZA (4 LETTERE)</Text>
              <TextInput
                style={[styles.input, { textAlign: 'center', letterSpacing: 6, fontSize: 20, fontWeight: 'bold' }]}
                placeholder="ABCD"
                placeholderTextColor="#8892B0"
                value={roomCodeInput}
                onChangeText={(text) => setRoomCodeInput(text.toUpperCase())}
                maxLength={4}
              />

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleJoinRoom}
                disabled={loading}
              >
                <LinearGradient colors={['#20C997', '#00E5FF']} style={styles.gradientBtn}>
                  <Ionicons name="enter" size={20} color="#050B14" />
                  <Text style={styles.actionBtnText}>UNISCITI A STANZA</Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </ScrollView>
        ) : (
          <View style={styles.roomActiveContainer}>
            <View style={styles.roomHeaderCard}>
              <Text style={styles.roomCodeLabel}>CODICE STANZA</Text>
              <Text style={styles.roomCodeValue}>{currentRoom.room_code}</Text>
              <Text style={styles.roomStatusSub}>Modalità: {GAME_MODES.find(m => m.id === currentGameMode)?.title || 'Classic'}</Text>
            </View>

            {isHost && (
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.sectionHeaderTitle, { marginBottom: 8 }]}>CAMBIA MODALITÀ (HOST)</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {GAME_MODES.map((mode) => (
                    <TouchableOpacity
                      key={mode.id}
                      style={[styles.modeSelectChip, currentGameMode === mode.id && { backgroundColor: mode.color, borderColor: mode.color }]}
                      onPress={() => handleSelectGameMode(mode.id)}
                    >
                      <Text style={[styles.modeSelectChipText, currentGameMode === mode.id && { color: '#050B14' }]}>{mode.title.split(' ')[0]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.playersListHeader}>
              <Text style={styles.sectionHeaderTitle}>GIOCATORI CONNESSI ({players.length}/8)</Text>
            </View>

            <FlatList
              data={players}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.playerRow}>
                  <View style={styles.playerInfo}>
                    <Ionicons
                      name={item.is_host ? 'shield' : 'person'}
                      size={18}
                      color={item.is_host ? '#FFD700' : '#00E5FF'}
                    />
                    <Text style={styles.playerNick}>{item.nickname}</Text>
                    {item.is_host && <Text style={styles.hostBadge}>HOST</Text>}
                  </View>
                  <View style={[styles.statusDot, { backgroundColor: '#39FF14' }]} />
                </View>
              )}
              contentContainerStyle={styles.playerListContent}
            />

            <View style={styles.roomFooter}>
              {isHost ? (
                <TouchableOpacity
                  style={[styles.startProtocolBtn, players.length < 3 && { opacity: 0.5 }]}
                  onPress={handleStartProtocol}
                  disabled={loading || players.length < 3}
                >
                  <LinearGradient colors={['#00E5FF', '#20C997']} style={styles.gradientBtn}>
                    <Ionicons name="play-circle" size={22} color="#050B14" />
                    <Text style={[styles.actionBtnText, { color: '#050B14' }]}>
                      {players.length < 3 ? 'SERVE ALMENO 3 GIOCATORI' : 'AVVIA NAUGHTY PACK (START)'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <View style={styles.waitingHostBox}>
                  <Text style={styles.waitingHostText}>In attesa che l'Host avvii il protocollo...</Text>
                </View>
              )}

              <TouchableOpacity style={styles.leaveBtn} onPress={handleLeaveRoom}>
                <Text style={styles.leaveBtnText}>ABBANDONA STANZA</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#050B14' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#233554',
  },
  backButton: { padding: 8 },
  headerTitle: { color: '#00E5FF', fontSize: 14, fontWeight: 'bold', letterSpacing: 1.5 },
  container: { flex: 1, padding: 16 },
  lobbyFormContainer: { paddingBottom: 40 },
  cardGlass: {
    backgroundColor: '#121624',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#233554',
  },
  cardTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center', letterSpacing: 1 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 85, 0.1)',
    borderWidth: 1,
    borderColor: '#FF0055',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  errorText: { color: '#FF0055', marginLeft: 8, fontSize: 13 },
  inputLabel: { color: '#8892B0', fontSize: 11, fontWeight: 'bold', marginBottom: 6, letterSpacing: 1 },
  input: {
    backgroundColor: '#050B14',
    borderWidth: 1,
    borderColor: '#233554',
    borderRadius: 8,
    color: '#FFFFFF',
    paddingHorizontal: 16,
    height: 48,
    fontSize: 15,
    marginBottom: 14,
  },
  gameModesGrid: { gap: 8, marginBottom: 16 },
  gameModeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#050B14',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#233554',
  },
  gameModeTitle: { color: '#FFF', fontSize: 13, fontWeight: 'bold', letterSpacing: 0.5 },
  gameModeDesc: { color: '#8892B0', fontSize: 11, marginTop: 2 },
  actionButton: { borderRadius: 8, overflow: 'hidden', marginTop: 4, marginBottom: 14 },
  gradientBtn: { flexDirection: 'row', height: 48, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: '#050B14', fontWeight: '900', fontSize: 13, letterSpacing: 1, marginLeft: 8 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 14 },
  line: { flex: 1, height: 1, backgroundColor: '#233554' },
  dividerText: { color: '#8892B0', paddingHorizontal: 10, fontSize: 11, fontWeight: 'bold' },
  roomActiveContainer: { flex: 1 },
  roomHeaderCard: {
    backgroundColor: '#121624',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00E5FF',
    marginBottom: 16,
  },
  roomCodeLabel: { color: '#8892B0', fontSize: 11, letterSpacing: 2, marginBottom: 4 },
  roomCodeValue: { color: '#00E5FF', fontSize: 34, fontWeight: 'bold', letterSpacing: 6, marginBottom: 4 },
  roomStatusSub: { color: '#8892B0', fontSize: 12 },
  modeSelectChip: { backgroundColor: '#121624', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#233554' },
  modeSelectChipText: { color: '#8892B0', fontSize: 11, fontWeight: 'bold' },
  playersListHeader: { marginBottom: 10 },
  sectionHeaderTitle: { color: '#8892B0', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  playerListContent: { paddingBottom: 20 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#121624',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#233554',
  },
  playerInfo: { flexDirection: 'row', alignItems: 'center' },
  playerNick: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold', marginLeft: 10 },
  hostBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    color: '#FFD700',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    overflow: 'hidden',
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  roomFooter: { marginTop: 'auto', paddingVertical: 10 },
  startProtocolBtn: { borderRadius: 8, overflow: 'hidden', marginBottom: 12 },
  waitingHostBox: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#121624',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#233554',
    marginBottom: 12,
  },
  waitingHostText: { color: '#8892B0', fontSize: 13, fontStyle: 'italic' },
  leaveBtn: { padding: 14, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#FF0055' },
  leaveBtnText: { color: '#FF0055', fontWeight: 'bold', fontSize: 13, letterSpacing: 1 },
});
