import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList, Image, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { BlurView } from 'expo-blur';

// Lista completa dei minigiochi richiesti
const ARCADE_GAMES = [
  { id: 'StroopTest', title: 'Stroop Test', icon: 'color-palette', color: '#FF00FF' },
  { id: 'ChuteTap', title: 'Chute Tap', icon: 'filter', color: '#00E5FF' },
  { id: 'Dominio15', title: 'Dominio 15', icon: 'layers', color: '#00E5FF' },
  { id: 'GravityRunner', title: 'Gravity Runner', icon: 'pulse', color: '#B026FF' },
  { id: 'Pong3D', title: 'Cyber Pong', icon: 'tennisball', color: '#FF0055' },
  { id: 'ShapeSmist', title: 'Shape Smist', icon: 'cube', color: '#39FF14' },
  { id: 'SimonDigital', title: 'Simon Digitale', icon: 'radio', color: '#39FF14' },
  { id: 'StopTheClock', title: 'Stop The Clock', icon: 'time', color: '#FFD700' },
  { id: 'TowerStack', title: 'Tower Stack', icon: 'albums', color: '#00F0FF' },
  { id: 'VisualCounter', title: 'Visual Counter', icon: 'eye', color: '#FF8800' },
  { id: 'WallBounce', title: 'Wall Bounce', icon: 'git-commit', color: '#39FF14' },
];

export default function ArcadeScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'ARCADE' | 'HOLONET'>('ARCADE');
  const [selectedGame, setSelectedGame] = useState(ARCADE_GAMES[0].id);
  
  const [arcadeScores, setArcadeScores] = useState<any[]>([]);
  const [narrativeScores, setNarrativeScores] = useState<any[]>([]);

  useEffect(() => {
    fetchLeaderboards(selectedGame);
  }, [selectedGame]);

  const fetchLeaderboards = async (gameId: string) => {
    setLoading(true);
    try {
      // Task 1: Query a user_best_scores con JOIN su profiles per evitare duplicati
      const { data: aData, error: aError } = await supabase
        .from('user_best_scores')
        .select('user_id, game_id, highest_score, profiles(username, avatar_url)')
        .eq('game_id', gameId)
        .order('highest_score', { ascending: false })
        .limit(50);
        
      if (aError || !aData) {
        const { data: fallbackData } = await supabase
          .from('user_best_scores')
          .select('user_id, game_id, highest_score')
          .eq('game_id', gameId)
          .order('highest_score', { ascending: false })
          .limit(50);
        setArcadeScores(fallbackData || []);
      } else {
        setArcadeScores(aData);
      }

      const { data: nData } = await supabase
        .from('daily_prompts')
        .select('*')
        .not('winning_username', 'is', null)
        .order('season_id', { ascending: false })
        .order('day_number', { ascending: false });
        
      setNarrativeScores(nData || []);

    } catch (error) {
      console.error("Errore fetch classifiche:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderArcadeItem = ({ item, index }: { item: any, index: number }) => {
    const isTop3 = index < 3;
    const color = '#00E5FF';
    const username = item.profiles?.username || `User_${item.user_id?.substring(0, 5) || '001'}`;
    
    return (
      <View style={[styles.card, isTop3 && { borderColor: color, borderWidth: 1 }]}>
        <Text style={[styles.rank, { color: isTop3 ? color : '#8892B0' }]}>#{index + 1}</Text>
        
        {item.profiles?.avatar_url ? (
          <Image source={{ uri: item.profiles.avatar_url }} style={[styles.avatar, { borderColor: color }]} />
        ) : (
          <View style={[styles.avatarPlaceholder, { borderColor: color }]}>
            <Ionicons name="person" size={16} color={color} />
          </View>
        )}
        
        <View style={styles.info}>
          <Text style={styles.username}>{username}</Text>
          <Text style={styles.gameId}>{item.game_id}</Text>
        </View>
        <Text style={[styles.score, { color }]}>{item.highest_score} <Text style={styles.unit}>PTS</Text></Text>
      </View>
    );
  };

  const renderNarrativeItem = ({ item }: { item: any }) => {
    return (
      <View style={[styles.card, { borderColor: '#39FF14', borderWidth: 1, backgroundColor: 'rgba(57, 255, 20, 0.05)', flexDirection: 'column', alignItems: 'flex-start', padding: 16 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 8 }}>
          <Text style={{ color: '#00E5FF', fontWeight: '900', fontSize: 13 }}>GIORNO {item.day_number} {item.season_id ? `(Stagione ${item.season_id})` : ''}</Text>
          <Text style={{ color: '#FF0055', fontWeight: '900', fontSize: 13 }}>VINCITORE: {item.winning_username}</Text>
        </View>
        <Text style={{ color: '#EAF4FF', fontSize: 14, fontStyle: 'italic', lineHeight: 20 }}>
          "{item.winning_response}"
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <BlurView intensity={80} tint="dark" style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#00E5FF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CLASSIFICA GLOBALE (BEST SCORES)</Text>
        <View style={{ width: 40 }} />
      </BlurView>

      <View style={styles.container}>
        
        {/* Toggle Tabs */}
        <View style={styles.tabContainer}>
            <TouchableOpacity 
                style={[styles.tab, activeTab === 'ARCADE' && styles.activeTab]}
                onPress={() => setActiveTab('ARCADE')}
            >
                <Text style={[styles.tabText, activeTab === 'ARCADE' && styles.activeTabText]}>ARCADE</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.tab, activeTab === 'HOLONET' && styles.activeTab]}
                onPress={() => setActiveTab('HOLONET')}
            >
                <Text style={[styles.tabText, activeTab === 'HOLONET' && styles.activeTabText]}>NARRATIVA</Text>
            </TouchableOpacity>
        </View>

        {/* Selezione Giochi */}
        {activeTab === 'ARCADE' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gamesScroll} contentContainerStyle={{ paddingHorizontal: 4 }}>
            {ARCADE_GAMES.map(g => (
              <TouchableOpacity
                key={g.id}
                style={[styles.gameChip, selectedGame === g.id && styles.activeGameChip]}
                onPress={() => setSelectedGame(g.id)}
                activeOpacity={0.8}
              >
                <Ionicons name={g.icon as any} size={16} color={selectedGame === g.id ? '#050B14' : g.color} style={{ marginRight: 6 }} />
                <Text style={[styles.gameChipText, selectedGame === g.id && styles.activeGameChipText]}>{g.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Lista Classifica */}
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#00E5FF" />
          </View>
        ) : activeTab === 'ARCADE' ? (
          <FlatList
            data={arcadeScores}
            keyExtractor={(item, index) => item.user_id ? `${item.user_id}-${item.game_id}` : index.toString()}
            renderItem={renderArcadeItem}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>Nessun record registrato per questo gioco.</Text>}
          />
        ) : (
          <FlatList
            data={narrativeScores}
            keyExtractor={(item, index) => item.user_id || index.toString()}
            renderItem={renderNarrativeItem}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>Nessun dato registrato nell'Holonet.</Text>}
          />
        )}

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#050B14' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0, 229, 255, 0.2)' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0, 229, 255, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.3)' },
  headerTitle: { color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 1.5 },
  container: { flex: 1, padding: 16 },
  
  tabContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: '#233554' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#00E5FF' },
  tabText: { color: '#8892B0', fontWeight: 'bold', fontSize: 13, letterSpacing: 1 },
  activeTabText: { color: '#050B14', fontWeight: '900' },

  gamesScroll: { maxHeight: 50, marginBottom: 16 },
  gameChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', marginRight: 8, borderWidth: 1, borderColor: '#233554', height: 40 },
  activeGameChip: { backgroundColor: '#00E5FF', borderColor: '#00E5FF' },
  gameChipText: { color: '#8892B0', fontWeight: 'bold', fontSize: 12 },
  activeGameChipText: { color: '#050B14', fontWeight: '900' },

  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingBottom: 24 },
  empty: { color: '#8892B0', textAlign: 'center', marginTop: 40, fontSize: 13, fontStyle: 'italic' },

  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(17, 34, 64, 0.6)', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#233554' },
  rank: { fontSize: 15, fontWeight: '900', width: 32, textAlign: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, marginRight: 12 },
  avatarPlaceholder: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,229,255,0.1)', marginRight: 12 },
  info: { flex: 1 },
  username: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  gameId: { color: '#8892B0', fontSize: 10, marginTop: 2 },
  score: { fontSize: 16, fontWeight: '900' },
  unit: { fontSize: 10, fontWeight: 'bold' }
});
