import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type Profile = { id: string; username: string; };

export default function UsersDirectoryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [displayedUsers, setDisplayedUsers] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    const { data } = await supabase.from('profiles').select('*').neq('id', user.id);
    if (data) {
      setAllUsers(data);
      setDisplayedUsers(data);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setDisplayedUsers(allUsers);
    } else {
      const filtered = allUsers.filter(u => u.username.toLowerCase().includes(text.toLowerCase()));
      setDisplayedUsers(filtered);
    }
  };

  const startChat = async (targetUser: Profile) => {
    if (!currentUserId) return;
    const { data: existingRooms } = await supabase
      .from('private_rooms')
      .select('id')
      .or(`and(user1_id.eq.${currentUserId},user2_id.eq.${targetUser.id}),and(user1_id.eq.${targetUser.id},user2_id.eq.${currentUserId})`);

    if (existingRooms && existingRooms.length > 0) {
      navigation.navigate('PrivateChat', { roomId: existingRooms[0].id, userName: targetUser.username });
    } else {
      const { data: newRoom } = await supabase.from('private_rooms').insert([{ user1_id: currentUserId, user2_id: targetUser.id }]).select('id').single();
      if (newRoom) navigation.navigate('PrivateChat', { roomId: newRoom.id, userName: targetUser.username });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#00F0FF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>RICERCA AGENTI</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => navigation.navigate('Main')}>
            <Ionicons name="home-outline" size={24} color="#00F0FF" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <TextInput 
            style={styles.input} 
            placeholder="Digita per filtrare..." 
            placeholderTextColor="#4A5578" 
            value={searchQuery} 
            onChangeText={handleSearch} 
          />
          <View style={styles.searchBtn}>
            <Ionicons name="search" size={20} color="#0B0D17" />
          </View>
        </View>

        <FlatList
          data={displayedUsers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.userCard} onPress={() => startChat(item)}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.username}>{item.username}</Text>
              <View style={styles.chatIconBtn}>
                <Ionicons name="chatbubble" size={18} color="#0B0D17" />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>Nessun agente trovato con questo nome.</Text>}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0B0D17' },
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backButton: { marginRight: 16 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  searchRow: { flexDirection: 'row', marginBottom: 24, gap: 10 },
  input: { flex: 1, backgroundColor: '#121624', color: '#FFF', borderRadius: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: '#1E2538', height: 48 },
  searchBtn: { backgroundColor: '#00F0FF', width: 48, height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#121624', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#1E2538', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#2B3552', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarText: { color: '#00F0FF', fontSize: 18, fontWeight: 'bold' },
  username: { flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  chatIconBtn: { backgroundColor: '#00F0FF', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#8A93B0', textAlign: 'center', marginTop: 40, fontSize: 14 },
});