import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, SafeAreaView, TextInput, Alert, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { supabase } from '../lib/supabase';

type ChatHubNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ChatHubScreen() {
  const navigation = useNavigation<ChatHubNavigationProp>();
  const isFocused = useIsFocused();
  const [allChats, setAllChats] = useState<any[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();

    const privateChannel = supabase
      .channel('public:private_messages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'private_messages' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    const groupChannel = supabase
      .channel('public:group_messages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_messages' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(privateChannel);
      supabase.removeChannel(groupChannel);
    };
  }, []);

  useEffect(() => {
    if (isFocused) fetchData();
  }, [isFocused]);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    // 1. Scarica i Gruppi
    const { data: myGroups } = await supabase.from('group_members').select('group_rooms(id, name, invite_code, created_at)').eq('user_id', user.id);
    
    let groupChats: any[] = [];
    if (myGroups) {
      for (const g of myGroups) {
        const room = g.group_rooms;
        if (!room) continue;

        const { data: messages } = await supabase
          .from('group_messages')
          .select('content, created_at, sender_id, is_read, media_type')
          .eq('room_id', room.id)
          .order('created_at', { ascending: false })
          .limit(1);

        const lastMsg = messages && messages.length > 0 ? messages[0] : null;

        const { count: unreadCount } = await supabase
          .from('group_messages')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', room.id)
          .neq('sender_id', user.id)
          .eq('is_read', false);

        let previewText = `Codice Invito: ${room.invite_code}`;
        if (lastMsg) {
          if (lastMsg.media_type === 'gif') previewText = '[GIF Animata]';
          else if (lastMsg.media_type === 'image') previewText = '[Foto 1-Time]';
          else previewText = lastMsg.content.length > 30 ? lastMsg.content.substring(0, 30) + '...' : lastMsg.content;
        }

        groupChats.push({
          id: room.id,
          name: room.name,
          type: 'group',
          subText: previewText,
          icon: 'people',
          color: '#00E5FF',
          lastActivity: lastMsg ? new Date(lastMsg.created_at).getTime() : new Date(room.created_at || Date.now()).getTime(),
          hasUnread: (unreadCount || 0) > 0
        });
      }
    }

    // 2. Scarica le Chat Private
    const { data: privateRooms } = await supabase.from('private_rooms').select('*').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
    let privateChats: any[] = [];
    
    if (privateRooms && privateRooms.length > 0) {
      const otherUserIds = privateRooms.map(r => r.user1_id === user.id ? r.user2_id : r.user1_id);
      const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', otherUserIds);
      
      for (const r of privateRooms) {
        const otherId = r.user1_id === user.id ? r.user2_id : r.user1_id;
        const profile = profiles?.find(p => p.id === otherId);

        const { data: messages } = await supabase
          .from('private_messages')
          .select('content, created_at, sender_id, is_read, media_type')
          .eq('room_id', r.id)
          .order('created_at', { ascending: false })
          .limit(1);

        const lastMsg = messages && messages.length > 0 ? messages[0] : null;

        const { count: unreadCount } = await supabase
          .from('private_messages')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', r.id)
          .neq('sender_id', user.id)
          .eq('is_read', false);

        let previewText = 'Chat Privata';
        if (lastMsg) {
          if (lastMsg.media_type === 'gif') previewText = '[GIF Animata]';
          else if (lastMsg.media_type === 'image') previewText = '[Foto 1-Time]';
          else previewText = lastMsg.content.length > 30 ? lastMsg.content.substring(0, 30) + '...' : lastMsg.content;
        }

        privateChats.push({
          id: r.id,
          name: profile ? profile.username : 'Utente',
          type: 'private',
          subText: previewText,
          icon: 'person',
          color: '#00E5FF',
          lastActivity: lastMsg ? new Date(lastMsg.created_at).getTime() : new Date(r.created_at || Date.now()).getTime(),
          hasUnread: (unreadCount || 0) > 0
        });
      }
    }

    const combined = [...groupChats, ...privateChats];
    combined.sort((a, b) => b.lastActivity - a.lastActivity);

    setAllChats(combined);
  };

  const joinGroup = async () => {
    if (!inviteCode.trim() || !currentUserId) return;
    const { data: room } = await supabase.from('group_rooms').select('*').eq('invite_code', inviteCode.trim()).single();
    if (!room) { Alert.alert("Errore", "Codice non valido."); return; }
    
    const { data: exists } = await supabase.from('group_members').select('*').eq('room_id', room.id).eq('user_id', currentUserId).single();
    if (!exists) await supabase.from('group_members').insert([{ room_id: room.id, user_id: currentUserId }]);
    
    setInviteCode('');
    fetchData();
    navigation.navigate('GroupChat', { roomId: room.id, groupName: room.name });
  };

  const createGroup = async () => {
    if (!currentUserId) return;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const finalRoomName = newRoomName.trim() !== '' ? newRoomName.trim() : `Stanza-${code}`;
    const { data: newRoom } = await supabase.from('group_rooms').insert([{ name: finalRoomName, invite_code: code, created_by: currentUserId }]).select().single();
    if (newRoom) {
      await supabase.from('group_members').insert([{ room_id: newRoom.id, user_id: currentUserId }]);
      setNewRoomName('');
      fetchData();
    }
  };

  const openChat = (item: any) => {
    if (item.type === 'group') {
      navigation.navigate('GroupChat', { roomId: item.id, groupName: item.name });
    } else {
      navigation.navigate('PrivateChat', { roomId: item.id, userName: item.name });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      
      {/* Navigation Header */}
      <View style={styles.headerTopBar}>
        <TouchableOpacity 
          style={styles.navButton} 
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#00E5FF" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navButton} 
          onPress={() => navigation.navigate('Profile')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="home" size={20} color="#00E5FF" />
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTag}>RETE DI COMUNICAZIONE</Text>
          <Text style={styles.headerTitle}>Comms_Link</Text>
        </View>
        
        <View style={styles.actionRow}>
          <TextInput style={styles.input} placeholder="Codice Invito..." placeholderTextColor="#8892B0" value={inviteCode} onChangeText={setInviteCode} />
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#00E5FF' }]} onPress={joinGroup}><Text style={styles.btnText}>UNISCITI</Text></TouchableOpacity>
        </View>
        
        <View style={styles.actionRow}>
          <TextInput style={styles.input} placeholder="Nome Nuova Stanza..." placeholderTextColor="#8892B0" value={newRoomName} onChangeText={setNewRoomName} />
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#20C997' }]} onPress={createGroup}><Text style={styles.btnText}>CREA</Text></TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.searchFullBtn} onPress={() => navigation.navigate('UsersDirectory')}>
          <Ionicons name="search" size={20} color="#050B14" />
          <Text style={[styles.btnText, { marginLeft: 8 }]}>CERCA AGENTE PER CHAT PRIVATA</Text>
        </TouchableOpacity>

        <View style={styles.separatorContainer}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>TUTTE LE CONVERSAZIONI</Text>
          <View style={styles.separatorLine} />
        </View>

        <FlatList
          data={allChats}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openChat(item)}>
              <View style={[styles.cardIcon, { backgroundColor: `${item.color}1A` }]}>
                <Ionicons name={item.icon} size={24} color={item.color} />
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                  {item.hasUnread && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>NUOVO</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.cardSub, item.hasUnread && { color: '#00E5FF', fontWeight: '600' }]} numberOfLines={1}>
                  {item.subText}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={item.color} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>Nessuna conversazione attiva.</Text>}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#050B14' }, 
  headerTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#233554',
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,229,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.3)',
  },
  container: { flex: 1, padding: 16 },
  header: { marginBottom: 24 },
  headerTag: { color: '#00E5FF', fontSize: 11, letterSpacing: 2, fontWeight: '700', marginBottom: 4 },
  headerTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', letterSpacing: 1 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  input: { flex: 1, backgroundColor: '#121624', color: '#FFF', borderRadius: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: '#233554', height: 48 },
  btn: { paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center', borderRadius: 8, minWidth: 100 },
  searchFullBtn: { flexDirection: 'row', backgroundColor: '#00E5FF', padding: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  btnText: { color: '#050B14', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  separatorContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  separatorLine: { flex: 1, height: 1, backgroundColor: '#233554' },
  separatorText: { color: '#8892B0', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.5, marginHorizontal: 10 },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#121624', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#233554', marginBottom: 12 },
  cardIcon: { width: 46, height: 46, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  cardTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 18, marginBottom: 4 }, 
  cardSub: { color: '#8892B0', fontSize: 13 },
  badge: { backgroundColor: '#00E5FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { color: '#050B14', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  emptyText: { color: '#8892B0', textAlign: 'center', marginTop: 40, fontSize: 14, fontStyle: 'italic' }
});