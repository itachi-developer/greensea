import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity, FlatList, ActivityIndicator, Image, TextInput, KeyboardAvoidingView, Platform, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

const ROOM_GAMES = [
  { id: 'ColorMatch', name: 'COLOR MATCH' },
  { id: 'SimonDigital', name: 'SIMON DIGITAL' },
  { id: 'GravityRunner', name: 'GRAVITY RUNNER' },
  { id: 'ChuteTap', name: 'CHUTE TAP' },
  { id: 'WallBounce', name: 'WALL BOUNCE' },
  { id: 'Pong3D', name: 'CYBER PONG 3D' },
  { id: 'TowerStack', name: 'TOWER STACK' },
  { id: 'ShapeSmist', name: 'SHAPE SMIST' },
  { id: 'StopTheClock', name: 'STOP THE CLOCK' },
  { id: 'MathFall', name: 'MATH FALL' },
  { id: 'VisualCounter', name: 'VISUAL COUNTER' },
  { id: 'StroopTest', name: 'STROOP TEST' },
  { id: 'Dominio15', name: 'DOMINIO 15' },
  { id: 'Paradox', name: 'PARADOX' },
];

export default function RoomDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { roomId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [roomData, setRoomData] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [gameOfTheDay, setGameOfTheDay] = useState<any>(ROOM_GAMES[0]);
  const [playDate, setPlayDate] = useState<string>('');

  // Task 1: Gestione dello Stato della Data
  const [viewDate, setViewDate] = useState(new Date());
  const viewDateRef = useRef(viewDate);
  useEffect(() => {
    viewDateRef.current = viewDate;
  }, [viewDate]);

  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState('Agente');
  const [activeTab, setActiveTab] = useState<'LEADERBOARD' | 'CHAT'>('LEADERBOARD');

  // Stati per il Modale Custom di Rinomina Stanza (Task)
  const [isRenameModalVisible, setRenameModalVisible] = useState(false);
  const [newNameInput, setNewNameInput] = useState('');

  const holoColor = '#00E5FF';

  const todayStr = new Date().toISOString().split('T')[0];
  const viewDateStr = viewDate.toISOString().split('T')[0];
  const isToday = viewDateStr === todayStr;

  const startOfDay = new Date(viewDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(viewDate);
  endOfDay.setHours(23, 59, 59, 999);

  const handlePrevDay = () => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() - 1);
    setViewDate(d);
  };

  const handleNextDay = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next = new Date(viewDate);
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    if (next <= today) {
      setViewDate(next);
    }
  };

  const formatViewDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    if (target.getTime() === today.getTime()) {
      return 'OGGI';
    }
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const calculateGameOfTheDay = () => {
    const timeMs = viewDate.getTime();
    const daysSinceEpoch = Math.floor((timeMs - 8 * 60 * 60 * 1000) / (1000 * 60 * 60 * 24));
    const gameIndex = Math.abs(daysSinceEpoch) % ROOM_GAMES.length;

    setGameOfTheDay(ROOM_GAMES[gameIndex]);
    setPlayDate(viewDateStr);
  };

  useFocusEffect(
    React.useCallback(() => {
      calculateGameOfTheDay();
      if (roomId) {
        fetchRoomDetailsAndLeaderboard();
        initChat();
      }
    }, [roomId, viewDate])
  );

  const initChat = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: prof } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle();
        if (prof?.username) setCurrentUsername(prof.username);
      }
      fetchMessages();
    } catch (err) {
      console.error("Errore init chat:", err);
    }
  };

  // Task 2: Aggiornare le Query di Fetch dei messaggi
  const fetchMessages = async () => {
    try {
      const { data } = await supabase
        .from('game_room_messages')
        .select('*, profiles(username, avatar_url)')
        .eq('room_id', roomId)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .order('created_at', { ascending: true })
        .limit(100);
      if (data) setMessages(data);
    } catch (err) {
      setMessages([]);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUserId || !roomId) return;
    const text = newMessage.trim();
    setNewMessage('');

    try {
      const { error } = await supabase
        .from('game_room_messages')
        .insert({
          room_id: roomId,
          user_id: currentUserId,
          content: text
        });

      if (error) {
        console.error("ERRORE INSERIMENTO MESSAGGIO:", error);
        Alert.alert("Errore", "Impossibile inviare il messaggio. Riprova più tardi.");
      }
    } catch (err) {
      console.error("Errore invio messaggio chat stanza:", err);
      Alert.alert("Errore", "Impossibile inviare il messaggio. Controlla la connessione.");
    }
  };

  const fetchRoomDetailsAndLeaderboard = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data: room, error: roomError } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (roomError) {
        console.error("Errore fetch stanza:", roomError);
      } else {
        setRoomData(room);
      }

      const timeMs = viewDate.getTime();
      const daysSinceEpoch = Math.floor((timeMs - 8 * 60 * 60 * 1000) / (1000 * 60 * 60 * 24));
      const currentGame = ROOM_GAMES[Math.abs(daysSinceEpoch) % ROOM_GAMES.length];
      setGameOfTheDay(currentGame);
      setPlayDate(viewDateStr);

      // Task 2: Punteggi filtrati per viewDate (play_date)
      const { data: scoresData, error: scoreError } = await supabase
        .from('game_room_scores')
        .select('id, highest_score, user_id, play_date, profiles(username, avatar_url)')
        .eq('room_id', roomId)
        .eq('play_date', viewDateStr)
        .order('highest_score', { ascending: false });

      if (scoreError) {
        console.error("Errore fetch punteggi:", scoreError);
      }

      const rawScores = scoresData || [];
      const userScoresMap: { [userId: string]: any } = {};
      rawScores.forEach(score => {
        if (!userScoresMap[score.user_id]) {
          userScoresMap[score.user_id] = { ...score, highest_score: score.highest_score };
        } else {
          userScoresMap[score.user_id].highest_score += score.highest_score;
        }
      });
      const aggregatedScores = Object.values(userScoresMap).sort((a: any, b: any) => b.highest_score - a.highest_score);
      setLeaderboard(aggregatedScores);

      await fetchMessages();

    } catch (error) {
      console.error("Errore caricamento dettagli stanza:", error);
      Alert.alert("Errore", "Impossibile caricare i dettagli della stanza. Controlla la connessione.");
    } finally {
      setLoading(false);
    }
  }, [roomId, viewDate]);

  useEffect(() => {
    if (!roomId) {
      console.log("[DEBUG Realtime] roomId non disponibile:", roomId);
      return;
    }
    console.log("[DEBUG Realtime] Avvio sottoscrizioni per room_id:", roomId);

    const scoreChannel = supabase
      .channel(`room-scores:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_room_scores',
          filter: `room_id=eq.${roomId}`
        },
        payload => {
          console.log("NUOVO DATO REALTIME RICEVUTO (SCORES):", payload);
          fetchRoomDetailsAndLeaderboard();
        }
      )
      .subscribe((status, err) => {
        console.log('Stato Realtime Scores:', status, err);
      });

    const chatChannel = supabase
      .channel(`room-chat:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_room_messages',
          filter: `room_id=eq.${roomId}`
        },
        async (payload) => {
          console.log("NUOVO DATO REALTIME RICEVUTO (CHAT):", payload);
          const newMsg = payload.new as any;
          
          // Task 5: Fix Realtime per i Giorni Passati
          const curTodayStr = new Date().toISOString().split('T')[0];
          const curViewDateStr = viewDateRef.current.toISOString().split('T')[0];
          if (curViewDateStr !== curTodayStr) {
            return; // Se stiamo visualizzando un giorno passato, ignoriamo i nuovi messaggi realtime di oggi
          }

          const { data: prof } = await supabase.from('profiles').select('username, avatar_url').eq('id', newMsg.sender_id || newMsg.user_id).maybeSingle();
          newMsg.profiles = prof || { username: 'Agente' };
          
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe((status, err) => {
        console.log('Stato Realtime Chat:', status, err);
      });

    return () => {
      console.log("[DEBUG Realtime] Rimozione canali per room_id:", roomId);
      supabase.removeChannel(scoreChannel);
      supabase.removeChannel(chatChannel);
    };
  }, [roomId]);

  const isHost = currentUserId && roomData && (currentUserId === roomData.host_id || currentUserId === roomData.created_by);

  const handleRenameRoom = () => {
    setNewNameInput(roomData?.name || '');
    setRenameModalVisible(true);
  };

  const submitRenameRoom = async () => {
    if (!newNameInput.trim()) return;
    try {
      const { error } = await supabase.from('game_rooms').update({ name: newNameInput.trim() }).eq('id', roomId);
      if (error) throw error;
      setRoomData((prev: any) => ({ ...prev, name: newNameInput.trim() }));
      setRenameModalVisible(false);
      setNewNameInput('');
    } catch (err: any) {
      alert("Errore rinomina: " + (err?.message || "Errore"));
    }
  };

  const handleAdminDeleteRoom = () => {
    Alert.alert(
      "ELIMINA STANZA",
      "Sei sicuro di voler eliminare questa Game Room per tutti i partecipanti?",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "ELIMINA",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase.rpc('delete_game_room_if_admin', { room_id_param: roomId });
              if (error) throw error;
              navigation.goBack();
            } catch (err: any) {
              alert("Errore eliminazione stanza: " + (err?.message || "Errore"));
            }
          }
        }
      ]
    );
  };

  const handleParticipantLeaveRoom = () => {
    Alert.alert(
      "ESCI DALLA STANZA",
      "Sei sicuro di voler uscire da questa Game Room?",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "ESCI",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase.rpc('leave_game_room', { room_id_param: roomId });
              if (error) throw error;
              navigation.goBack();
            } catch (err: any) {
              alert("Errore uscita stanza: " + (err?.message || "Errore"));
            }
          }
        }
      ]
    );
  };

  const handleStartSimulation = () => {
    if (!gameOfTheDay) return;
    navigation.navigate(gameOfTheDay.id, {
      roomId,
      isRoomMode: true,
      playDate
    });
  };

  const renderScoreItem = ({ item, index }: { item: any, index: number }) => {
    const isTop3 = index < 3;
    const username = item.profiles?.username || `Agente_${item.user_id?.substring(0, 5) || '001'}`;

    return (
      <View style={[styles.scoreCard, isTop3 && { borderColor: holoColor }]}>
        <Text style={[styles.scoreRank, { color: isTop3 ? holoColor : '#8892B0' }]}>#{index + 1}</Text>
        
        {item.profiles?.avatar_url ? (
          <Image source={{ uri: item.profiles.avatar_url }} style={styles.scoreAvatar} />
        ) : (
          <View style={styles.scoreAvatarPlaceholder}>
            <Ionicons name="person" size={16} color={holoColor} />
          </View>
        )}

        <View style={styles.scoreInfo}>
          <Text style={styles.scoreUsername}>{username}</Text>
          <Text style={styles.scoreDate}>DATA: {item.play_date}</Text>
        </View>

        <View style={styles.scoreBadge}>
          <Text style={styles.scoreValue}>{item.highest_score} PTS</Text>
        </View>
      </View>
    );
  };

  const renderMessageItem = ({ item }: { item: any }) => {
    const isMe = (item.user_id || item.sender_id) === currentUserId;
    const username = item.profiles?.username || `Agente_${(item.user_id || item.sender_id)?.substring(0, 5) || '001'}`;
    const avatarUrl = item.profiles?.avatar_url;
    const formattedTime = item.created_at
      ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <View style={[styles.chatRow, isMe ? styles.chatRowMe : styles.chatRowOther]}>
        {!isMe && (
          avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.chatAvatar} />
          ) : (
            <View style={styles.chatAvatarPlaceholder}>
              <Ionicons name="person" size={14} color={holoColor} />
            </View>
          )
        )}

        {isMe ? (
          <LinearGradient
            colors={['#00E5FF', '#00B4D8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.chatBubbleMe}
          >
            <Text style={styles.chatTextMe}>{item.content}</Text>
            <Text style={styles.chatTimeMe}>{formattedTime}</Text>
          </LinearGradient>
        ) : (
          <View style={styles.chatBubbleOther}>
            <Text style={styles.chatAuthor}>{username}</Text>
            <Text style={styles.chatTextOther}>{item.content}</Text>
            <Text style={styles.chatTimeOther}>{formattedTime}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={holoColor} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{roomData?.name || 'SALA TATTICA'}</Text>
        
        {isHost ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={handleRenameRoom} style={styles.hostHeaderBtn}>
              <Ionicons name="pencil" size={16} color={holoColor} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleAdminDeleteRoom} style={styles.hostHeaderBtn}>
              <Ionicons name="trash" size={16} color="#FF0055" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={handleParticipantLeaveRoom} style={styles.hostHeaderBtn}>
            <Ionicons name="exit-outline" size={18} color="#FF8800" />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        {/* Banner Gioco del Giorno */}
        <LinearGradient colors={['rgba(0, 229, 255, 0.2)', '#050B14']} style={styles.targetBanner}>
          <View style={styles.targetHeader}>
            <Ionicons name="flash" size={22} color={holoColor} />
            <Text style={styles.targetTag}>TARGET ODIERNO // 08:00 SHIFT</Text>
          </View>
          <Text style={styles.targetGameName}>{gameOfTheDay.name}</Text>
          <Text style={styles.targetSub}>Il bonus della turbina è attivo in questa stanza.</Text>

          <TouchableOpacity 
            style={[styles.startButton, { backgroundColor: holoColor }]}
            onPress={handleStartSimulation}
            activeOpacity={0.85}
          >
            <Ionicons name="play" size={20} color="#050B14" style={{ marginRight: 8 }} />
            <Text style={styles.startButtonText}>AVVIA SIMULAZIONE</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Task 3: UI Navigatore del Tempo */}
        <View style={styles.dateNavigator}>
          <TouchableOpacity onPress={handlePrevDay} style={styles.dateNavBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={holoColor} />
            <Text style={styles.dateNavText}>Indietro</Text>
          </TouchableOpacity>
          
          <View style={styles.dateDisplayBox}>
            <Ionicons name="calendar-outline" size={14} color={holoColor} style={{ marginRight: 6 }} />
            <Text style={styles.dateDisplayText}>{formatViewDate(viewDate)}</Text>
          </View>

          <TouchableOpacity 
            onPress={handleNextDay} 
            style={[styles.dateNavBtn, isToday && { opacity: 0.4 }]} 
            disabled={isToday}
            activeOpacity={0.7}
          >
            <Text style={[styles.dateNavText, isToday && { color: '#8892B0' }]}>Avanti</Text>
            <Ionicons name="chevron-forward" size={20} color={isToday ? '#8892B0' : holoColor} />
          </TouchableOpacity>
        </View>

        {/* Tab Switcher: Classifica / Chat */}
        <View style={styles.tabRow}>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'LEADERBOARD' && styles.activeTabBtn]} 
            onPress={() => setActiveTab('LEADERBOARD')}
          >
            <Ionicons name="trophy" size={16} color={activeTab === 'LEADERBOARD' ? holoColor : '#8892B0'} style={{ marginRight: 6 }} />
            <Text style={[styles.tabText, activeTab === 'LEADERBOARD' && styles.activeTabText]}>CLASSIFICA</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'CHAT' && styles.activeTabBtn]} 
            onPress={() => setActiveTab('CHAT')}
          >
            <Ionicons name="chatbubbles" size={16} color={activeTab === 'CHAT' ? holoColor : '#8892B0'} style={{ marginRight: 6 }} />
            <Text style={[styles.tabText, activeTab === 'CHAT' && styles.activeTabText]}>CHAT STANZA</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'LEADERBOARD' ? (
          <>
            <Text style={styles.sectionTitle}>CLASSIFICA STANZA (HIGH-SCORE)</Text>
            {loading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={holoColor} />
              </View>
            ) : leaderboard.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="trophy-outline" size={48} color="#8892B0" style={{ marginBottom: 12 }} />
                <Text style={styles.emptyText}>Nessun record registrato per questa data.</Text>
                <Text style={styles.emptySubText}>Avvia la simulazione per stabilire il primato della stanza!</Text>
              </View>
            ) : (
              <FlatList
                data={leaderboard}
                keyExtractor={(item) => item.id}
                renderItem={renderScoreItem}
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
              />
            )}
          </>
        ) : (
          <View style={styles.chatContainer}>
            <FlatList
              data={messages}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderMessageItem}
              contentContainerStyle={styles.chatList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={<Text style={styles.emptyChat}>Nessun messaggio in questa data. Inizia la conversazione!</Text>}
            />
            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder="Scrivi un messaggio..."
                placeholderTextColor="#8892B0"
                value={newMessage}
                onChangeText={setNewMessage}
                maxLength={250}
              />
              <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage}>
                <Ionicons name="send" size={18} color="#050B14" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Custom Rename Modal (Cross-Platform) */}
      <Modal visible={isRenameModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.customModalCard}>
            <Text style={styles.customModalTitle}>RINOMINA STANZA</Text>
            <TextInput
              style={styles.customModalInput}
              placeholder="Nuovo nome stanza..."
              placeholderTextColor="#8892B0"
              value={newNameInput}
              onChangeText={setNewNameInput}
              maxLength={40}
            />
            <View style={styles.customModalBtnRow}>
              <TouchableOpacity style={styles.customModalCancelBtn} onPress={() => setRenameModalVisible(false)}>
                <Text style={styles.customModalCancelText}>ANNULLA</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.customModalSaveBtn} onPress={submitRenameRoom}>
                <Text style={styles.customModalSaveText}>SALVA</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#050B14' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0, 229, 255, 0.2)' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0, 229, 255, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.3)' },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1.5, flex: 1, textAlign: 'center', marginHorizontal: 10 },
  hostHeaderBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#233554' },

  container: { flex: 1, padding: 16 },
  targetBanner: { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.4)', padding: 20, marginBottom: 16, overflow: 'hidden' },
  targetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  targetTag: { color: '#00E5FF', fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginLeft: 8 },
  targetGameName: { color: '#FFF', fontSize: 24, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 },
  targetSub: { color: '#8892B0', fontSize: 12, marginBottom: 16, fontStyle: 'italic' },
  startButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12 },
  startButtonText: { color: '#050B14', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  
  // Task 3: Date Navigator Styles
  dateNavigator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: '#233554', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16 },
  dateNavBtn: { flexDirection: 'row', alignItems: 'center', padding: 6 },
  dateNavText: { color: '#00E5FF', fontSize: 12, fontWeight: 'bold', marginHorizontal: 4 },
  dateDisplayBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,229,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,229,255,0.3)' },
  dateDisplayText: { color: '#00E5FF', fontSize: 13, fontWeight: '900', letterSpacing: 1 },

  tabRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  tabBtn: { flex: 1, flexDirection: 'row', height: 42, borderRadius: 10, borderWidth: 1, borderColor: '#233554', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)' },
  activeTabBtn: { borderColor: '#00E5FF', backgroundColor: 'rgba(0,229,255,0.1)' },
  tabText: { color: '#8892B0', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  activeTabText: { color: '#00E5FF', fontWeight: '900' },

  sectionTitle: { color: '#8892B0', fontSize: 12, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyText: { color: '#E6F1FF', fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  emptySubText: { color: '#8892B0', fontSize: 13, textAlign: 'center' },
  listContainer: { paddingBottom: 24 },
  scoreCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  scoreRank: { fontSize: 16, fontWeight: '900', width: 36 },
  scoreAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#00E5FF', marginRight: 12 },
  scoreAvatarPlaceholder: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#00E5FF', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,229,255,0.1)', marginRight: 12 },
  scoreInfo: { flex: 1 },
  scoreUsername: { color: '#FFF', fontSize: 15, fontWeight: 'bold', marginBottom: 2 },
  scoreDate: { color: '#8892B0', fontSize: 10 },
  scoreBadge: { backgroundColor: 'rgba(0, 229, 255, 0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.3)' },
  scoreValue: { color: '#00E5FF', fontSize: 13, fontWeight: '900', letterSpacing: 1 },

  // Task 4: Restyling Chat Bubble Styles
  chatContainer: { flex: 1, backgroundColor: 'rgba(10, 25, 47, 0.5)', borderRadius: 16, borderWidth: 1, borderColor: '#233554', padding: 12 },
  chatList: { paddingBottom: 12 },
  emptyChat: { color: '#8892B0', fontSize: 13, textAlign: 'center', marginTop: 40, fontStyle: 'italic' },
  chatRow: { flexDirection: 'row', marginVertical: 4, marginHorizontal: 4, alignItems: 'flex-end' },
  chatRowMe: { justifyContent: 'flex-end' },
  chatRowOther: { justifyContent: 'flex-start' },
  chatAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#00E5FF', marginRight: 8, marginBottom: 4 },
  chatAvatarPlaceholder: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#00E5FF', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,229,255,0.1)', marginRight: 8, marginBottom: 4 },
  chatBubbleMe: { maxWidth: '80%', padding: 12, borderRadius: 16, borderBottomRightRadius: 4, marginBottom: 4 },
  chatBubbleOther: { maxWidth: '80%', padding: 12, borderRadius: 16, borderBottomLeftRadius: 4, marginBottom: 4, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: '#233554' },
  chatAuthor: { color: '#00E5FF', fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
  chatTextMe: { color: '#050B14', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  chatTextOther: { color: '#FFF', fontSize: 14, lineHeight: 20 },
  chatTimeMe: { color: '#003366', fontSize: 9, alignSelf: 'flex-end', marginTop: 4 },
  chatTimeOther: { color: '#8892B0', fontSize: 9, alignSelf: 'flex-end', marginTop: 4 },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#233554' },
  chatInput: { flex: 1, backgroundColor: '#112240', color: '#FFF', borderRadius: 20, paddingHorizontal: 16, height: 42, fontSize: 14, borderWidth: 1, borderColor: '#233554', marginRight: 10 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#00E5FF', justifyContent: 'center', alignItems: 'center' },

  // Custom Modal Styles
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(5, 7, 10, 0.85)', padding: 20 },
  customModalCard: { width: '100%', maxWidth: 360, backgroundColor: '#0A192F', borderRadius: 20, borderWidth: 1.5, borderColor: '#00E5FF', padding: 24, alignItems: 'center' },
  customModalTitle: { color: '#00E5FF', fontSize: 16, fontWeight: '900', letterSpacing: 1.5, marginBottom: 20 },
  customModalInput: { width: '100%', backgroundColor: '#112240', color: '#FFF', borderRadius: 12, paddingHorizontal: 16, height: 48, fontSize: 15, borderWidth: 1, borderColor: '#233554', marginBottom: 20 },
  customModalBtnRow: { flexDirection: 'row', gap: 12, width: '100%' },
  customModalCancelBtn: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#233554', justifyContent: 'center', alignItems: 'center' },
  customModalCancelText: { color: '#8892B0', fontWeight: 'bold', fontSize: 13 },
  customModalSaveBtn: { flex: 1, height: 46, borderRadius: 12, backgroundColor: '#00E5FF', justifyContent: 'center', alignItems: 'center' },
  customModalSaveText: { color: '#050B14', fontWeight: '900', fontSize: 13 }
});
