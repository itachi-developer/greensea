import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity, TextInput, FlatList, ActivityIndicator, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

export default function RoomHubScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<any[]>([]);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [creating, setCreating] = useState(false);

  const holoColor = '#00E5FF';

  useEffect(() => {
    fetchUserRooms();
  }, []);

  const fetchUserRooms = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Fetch memberships
      const { data: memberships, error: memError } = await supabase
        .from('game_room_members')
        .select('room_id, game_rooms(id, code, name, created_at)')
        .eq('user_id', user.id);

      if (memError) {
        console.error("Errore fetch membri stanza:", memError);
      } else if (memberships) {
        const resolvedRooms = memberships
          .map((m: any) => m.game_rooms)
          .filter((r: any) => r !== null);
        setRooms(resolvedRooms);
      }
    } catch (error) {
      console.error("Errore caricamento stanze:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Errore", "Utente non autenticato.");
        setCreating(false);
        return;
      }

      // Genera codice alfanumerico di 5 lettere
      const code = Math.random().toString(36).substring(2, 7).toUpperCase();
      const roomName = `Stanza di ${user.email?.split('@')[0] || 'Agente'} #${code}`;

      // 1. Inserisci in game_rooms
      const { data: newRoom, error: roomError } = await supabase
        .from('game_rooms')
        .insert({
          code,
          name: roomName,
          created_by: user.id
        })
        .select()
        .single();

      if (roomError) {
        throw roomError;
      }

      const roomId = newRoom ? newRoom.id : code;

      // 2. Inserisci in game_room_members
      const { error: memError } = await supabase
        .from('game_room_members')
        .insert({
          room_id: roomId,
          user_id: user.id
        });

      if (memError) {
        console.error("Errore inserimento membro:", memError);
      }

      Alert.alert("SUCCESSO", `Stanza creata con codice: ${code}`);
      navigation.navigate('RoomDetail', { roomId });
    } catch (error: any) {
      Alert.alert("Errore Creazione Stanza", error.message || "Impossibile creare la stanza.");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    const code = roomCodeInput.trim().toUpperCase();
    if (code.length !== 5) {
      Alert.alert("Codice non valido", "Inserisci un codice valido di 5 caratteri.");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Trova la stanza per codice
      const { data: roomData, error: roomError } = await supabase
        .from('game_rooms')
        .select('id, code, name')
        .eq('code', code)
        .maybeSingle();

      if (roomError || !roomData) {
        Alert.alert("Errore", "Stanza non trovata con questo codice.");
        return;
      }

      // Verifica se è già membro
      const { data: existingMem } = await supabase
        .from('game_room_members')
        .select('*')
        .eq('room_id', roomData.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existingMem) {
        const { error: joinError } = await supabase
          .from('game_room_members')
          .insert({
            room_id: roomData.id,
            user_id: user.id
          });
        if (joinError) throw joinError;
      }

      setJoinModalVisible(false);
      setRoomCodeInput('');
      navigation.navigate('RoomDetail', { roomId: roomData.id });
    } catch (error: any) {
      Alert.alert("Errore", error.message || "Impossibile unirsi alla stanza.");
    }
  };

  const renderRoomItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.roomCard}
      activeOpacity={0.8}
      onPress={() => navigation.navigate('RoomDetail', { roomId: item.id })}
    >
      <LinearGradient colors={['rgba(0, 229, 255, 0.1)', '#050B14']} style={styles.roomGradient}>
        <View style={styles.roomCardHeader}>
          <Ionicons name="shield-checkmark" size={22} color={holoColor} />
          <Text style={styles.roomCodeBadge}>CODICE: {item.code}</Text>
        </View>
        <Text style={styles.roomName}>{item.name}</Text>
        <View style={styles.roomFooter}>
          <Text style={styles.roomInfoText}>Tocca per accedere alla sala tattica</Text>
          <Ionicons name="chevron-forward" size={18} color={holoColor} />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={holoColor} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>GAME ROOM HUB</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.container}>
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity 
            style={[styles.actionBtn, { borderColor: holoColor }]}
            onPress={handleCreateRoom}
            disabled={creating}
            activeOpacity={0.8}
          >
            <LinearGradient colors={[`${holoColor}30`, '#050B14']} style={styles.actionGradient}>
              {creating ? (
                <ActivityIndicator size="small" color={holoColor} />
              ) : (
                <>
                  <Ionicons name="add-circle" size={28} color={holoColor} style={{ marginBottom: 6 }} />
                  <Text style={[styles.actionBtnText, { color: holoColor }]}>CREA STANZA</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, { borderColor: '#FF0055' }]}
            onPress={() => setJoinModalVisible(true)}
            activeOpacity={0.8}
          >
            <LinearGradient colors={['rgba(255, 0, 85, 0.25)', '#050B14']} style={styles.actionGradient}>
              <Ionicons name="enter" size={28} color="#FF0055" style={{ marginBottom: 6 }} />
              <Text style={[styles.actionBtnText, { color: '#FF0055' }]}>UNISCITI</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>STANZE ATTIVE & MEMRI</Text>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={holoColor} />
          </View>
        ) : rooms.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="radio-outline" size={48} color="#8892B0" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>Nessuna stanza attiva trovata.</Text>
            <Text style={styles.emptySubText}>Crea una stanza o unisciti con un codice.</Text>
          </View>
        ) : (
          <FlatList
            data={rooms}
            keyExtractor={(item) => item.id}
            renderItem={renderRoomItem}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Modal UNISCITI */}
      <Modal visible={joinModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <BlurView intensity={90} tint="dark" style={styles.modalContent}>
            <Text style={[styles.modalTitle, { color: holoColor }]}>ACCEDI A STANZA PRIVATA</Text>
            <Text style={styles.modalSub}>Inserisci il codice alfanumerico di 5 lettere comunicato dal creatore.</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="ES. A7X9K"
              placeholderTextColor="#8892B0"
              value={roomCodeInput}
              onChangeText={setRoomCodeInput}
              autoCapitalize="characters"
              maxLength={5}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalBtnCancel} 
                onPress={() => setJoinModalVisible(false)}
              >
                <Text style={styles.modalBtnCancelText}>ANNULLA</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalBtnJoin, { backgroundColor: holoColor }]} 
                onPress={handleJoinRoom}
              >
                <Text style={styles.modalBtnJoinText}>ENTRA</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#050B14' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0, 229, 255, 0.2)' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0, 229, 255, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.3)' },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1.5 },
  container: { flex: 1, padding: 16 },
  actionButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 12 },
  actionBtn: { flex: 1, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  actionGradient: { paddingVertical: 20, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { color: '#8892B0', fontSize: 12, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyText: { color: '#E6F1FF', fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  emptySubText: { color: '#8892B0', fontSize: 13, textAlign: 'center' },
  listContainer: { paddingBottom: 24 },
  roomCard: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.3)', marginBottom: 12, overflow: 'hidden' },
  roomGradient: { padding: 16 },
  roomCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  roomCodeBadge: { color: '#00E5FF', fontSize: 11, fontWeight: '900', letterSpacing: 1.5, backgroundColor: 'rgba(0, 229, 255, 0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  roomName: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  roomFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 10 },
  roomInfoText: { color: '#8892B0', fontSize: 11 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(5, 11, 20, 0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', borderRadius: 20, borderWidth: 1, borderColor: '#00E5FF', padding: 24, backgroundColor: 'rgba(10, 25, 47, 0.95)' },
  modalTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 1, marginBottom: 10, textAlign: 'center' },
  modalSub: { color: '#8892B0', fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 18 },
  modalInput: { backgroundColor: 'rgba(0, 229, 255, 0.08)', borderWidth: 1, borderColor: '#00E5FF', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#FFF', fontSize: 18, textAlign: 'center', fontWeight: '900', letterSpacing: 4, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalBtnCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalBtnCancelText: { color: '#8892B0', fontWeight: 'bold', fontSize: 13 },
  modalBtnJoin: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnJoinText: { color: '#050B14', fontWeight: '900', fontSize: 13, letterSpacing: 1 }
});
