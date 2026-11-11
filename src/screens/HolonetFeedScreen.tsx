import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, SafeAreaView, StatusBar, Image, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

export default function HolonetFeedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());

  const [dailyPrompt, setDailyPrompt] = useState<any>(null);
  const [seasonHistory, setSeasonHistory] = useState<any[]>([]);

  const holoColor = '#00E5FF';

  useEffect(() => {
    initHolonet();

    const channel = supabase
      .channel('holonet-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'social_posts'
        },
        payload => {
          fetchPosts();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'narrative_leaderboard'
        },
        payload => {
          fetchNarrativeContext();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const initHolonet = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      await fetchUserLikes(user.id);
    }
    await fetchNarrativeContext(); 
    await fetchPosts();
    setLoading(false);
  };

  const fetchUserLikes = async (userId: string) => {
    try {
      const { data } = await supabase.from('post_likes').select('post_id').eq('user_id', userId);
      if (data) {
        setLikedPostIds(new Set(data.map(l => l.post_id)));
      }
    } catch (err) {
      console.error('Errore fetch user likes:', err);
    }
  };

  const fetchNarrativeContext = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: todayPrompt } = await supabase.from('daily_prompts').select('*').eq('published_date', today).maybeSingle();
      
      const currentSeasonId = todayPrompt?.season_id || 1;

      const { data: historyData } = await supabase
        .from('daily_prompts')
        .select('*')
        .eq('season_id', currentSeasonId)
        .order('day_number', { ascending: true });

      if (historyData) {
        setSeasonHistory(historyData);
        const activePrompt = historyData.find(p => p.published_date === today) || historyData[historyData.length - 1];
        setDailyPrompt(activePrompt || todayPrompt);
      } else if (todayPrompt) {
        setDailyPrompt(todayPrompt);
        setSeasonHistory([todayPrompt]);
      }
    } catch (err) {
      console.log('Errore fetch contesto narrativo', err);
    }
  };

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('social_posts')
        .select('*, profiles(username, avatar_url)')
        .eq('is_daily_story', true)
        .order('created_at', { ascending: false });
        
      if (error || !data) {
        const { data: fallbackData } = await supabase
          .from('social_posts')
          .select('*')
          .eq('is_daily_story', true)
          .order('created_at', { ascending: false });
        setPosts(fallbackData || []);
      } else {
        setPosts(data);
      }
    } catch (err) {
      setPosts([]);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchNarrativeContext(); 
    await fetchPosts();
    setRefreshing(false);
  };

  const handleLike = async (postId: string, currentUpvotes: number) => {
    if (!currentUserId) return;
    const isLiked = likedPostIds.has(postId);
    const newLikedPostIds = new Set(likedPostIds);
    let newUpvotes = currentUpvotes || 0;

    try {
      if (!isLiked) {
        await supabase.from('post_likes').insert({ post_id: postId, user_id: currentUserId });
        newLikedPostIds.add(postId);
        newUpvotes += 1;
      } else {
        await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', currentUserId);
        newLikedPostIds.delete(postId);
        newUpvotes = Math.max(0, newUpvotes - 1);
      }
      setLikedPostIds(newLikedPostIds);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, upvotes: newUpvotes } : p));
      
      await supabase.from('social_posts').update({ upvotes: newUpvotes }).eq('id', postId);
    } catch (err) {
      console.error('Errore gestione like:', err);
    }
  };

  const renderPost = ({ item }: { item: any }) => {
    const timeAgo = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const profileObj = item.profiles;
    const username = profileObj?.username || 'Utente';
    const avatarUrl = profileObj?.avatar_url;
    const avatarInitial = username.charAt(0).toUpperCase();
    const isLiked = likedPostIds.has(item.id);

    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarBox}>
              <Text style={styles.avatarText}>{avatarInitial}</Text>
            </View>
          )}
          <View style={styles.postMeta}>
            <Text style={styles.authorName}>{username}</Text>
            <Text style={styles.postTime}>{timeAgo} • RISPOSTA ALLA STORIA</Text>
          </View>
        </View>

        <Text style={styles.postContent}>{item.content}</Text>

        <View style={styles.postFooter}>
          <TouchableOpacity style={styles.footerAction} onPress={() => handleLike(item.id, item.upvotes)}>
            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={18} color={isLiked ? "#FF0055" : "#8892B0"} style={{ marginRight: 6 }} />
            <Text style={[styles.actionText, isLiked && { color: '#FF0055' }]}>{item.upvotes || 0}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const sections = seasonHistory.map(prompt => {
    const dayPosts = posts.filter(p => p.prompt_id === prompt.id);
    return {
      title: `GIORNO ${prompt.day_number}`,
      prompt: prompt,
      data: dayPosts
    };
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navBtn}>
            <Ionicons name="arrow-back" size={20} color={holoColor} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.navBtn}>
            <Ionicons name="home" size={18} color={holoColor} />
          </TouchableOpacity>
          
          <Ionicons name="radio" size={22} color={holoColor} style={{ marginLeft: 8, marginRight: 8 }} />
          <Text style={styles.topHeaderTitle}>L'HOLONET</Text>
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPost}
        renderSectionHeader={({ section }) => {
          const prompt = section.prompt;
          const isToday = dailyPrompt?.id === prompt.id;
          return (
            <View style={styles.sectionHeaderContainer}>
              <View style={styles.daySeparator}>
                <View style={styles.daySeparatorLine} />
                <Text style={styles.daySeparatorText}>GIORNO {prompt.day_number}</Text>
                <View style={styles.daySeparatorLine} />
              </View>

              <View style={styles.bookContainer}>
                <Text style={styles.bookParagraph}>
                  <Text style={styles.aiSentence}>{prompt.prompt_text} </Text>
                  {prompt.winning_response ? (
                    <Text style={styles.userSentence}>{prompt.winning_response} <Text style={{color: '#FF0055'}}>({prompt.winning_username})</Text></Text>
                  ) : null}
                </Text>
              </View>

              {isToday && !prompt.winning_response && (
                <View style={styles.dailyPromptCard}>
                  <LinearGradient colors={['rgba(0, 229, 255, 0.15)', 'rgba(17, 34, 64, 0.95)']} style={styles.promptGradient}>
                    <View style={styles.promptHeader}>
                      <View style={styles.promptLiveDot} />
                      <Text style={styles.promptTag}>OGGI - GIORNO {prompt.day_number}</Text>
                    </View>
                    <Text style={styles.promptText}>{prompt.prompt_text}</Text>
                    
                    <TouchableOpacity style={styles.promptButton} onPress={() => navigation.navigate('Profile')}>
                      <Ionicons name="create-outline" size={18} color="#050B14" style={{ marginRight: 8 }} />
                      <Text style={styles.promptButtonText}>SCRIVI LA TUA FRASE</Text>
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
              )}

              {section.data.length > 0 && (
                <Text style={styles.postsHeaderLabel}>TRASMISSIONI AGENTI (GIORNO {prompt.day_number})</Text>
              )}
            </View>
          );
        }}
        contentContainerStyle={styles.feedScroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={holoColor} />
        }
        ListEmptyComponent={loading ? undefined : (
          <View style={styles.emptyBox}>
            <Ionicons name="radio-outline" size={48} color="#233554" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>Nessun post presente nell'Holonet.</Text>
            <Text style={styles.emptySubText}>Attendi la prossima trasmissione.</Text>
          </View>
        )}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#050B14' },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#233554',
    backgroundColor: '#050B14',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,229,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.3)',
  },
  topHeaderTitle: { color: '#E6F1FF', fontSize: 16, fontWeight: '900', letterSpacing: 1.5 },
  
  feedScroll: { padding: 16, paddingBottom: 100 },
  
  narrativeContainer: { marginBottom: 16 },
  sectionHeaderContainer: { marginBottom: 16 },
  bookContainer: { backgroundColor: 'rgba(10, 25, 47, 0.85)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.3)', padding: 20, marginBottom: 20 },
  bookTitle: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 2, textAlign: 'center', marginBottom: 4 },
  bookSubtitle: { color: '#8892B0', fontSize: 11, fontWeight: '600', letterSpacing: 1, textAlign: 'center', marginBottom: 20 },
  bookTextFlow: { gap: 16 },
  
  bookParagraphContainer: { marginBottom: 8 },
  daySeparator: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  daySeparatorLine: { flex: 1, height: 1, backgroundColor: 'rgba(0, 229, 255, 0.15)' },
  daySeparatorText: { color: '#00E5FF', fontSize: 10, fontWeight: '900', letterSpacing: 2, paddingHorizontal: 12, opacity: 0.8 },
  
  bookParagraph: { fontSize: 15, lineHeight: 26 },
  aiSentence: { color: '#E6F1FF', fontWeight: '400' },
  userSentence: { color: '#00E5FF', fontStyle: 'italic', fontWeight: '600' },

  dailyPromptCard: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#00E5FF', marginBottom: 24, backgroundColor: '#112240' },
  promptGradient: { padding: 20 },
  promptHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  promptLiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#39FF14', marginRight: 8, shadowColor: '#39FF14', shadowOpacity: 0.8, shadowRadius: 5 },
  promptTag: { color: '#39FF14', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  promptText: { color: '#E6F1FF', fontSize: 15, fontWeight: '600', lineHeight: 24, marginBottom: 20 },
  promptButton: { backgroundColor: '#00E5FF', minHeight: 48, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  promptButtonText: { color: '#050B14', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  
  postsHeaderLabel: { color: '#8892B0', fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 16, textAlign: 'center' },

  postCard: { backgroundColor: 'rgba(17, 34, 64, 0.6)', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#233554' },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatarBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0, 229, 255, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.3)', marginRight: 12 },
  avatarImage: { width: 40, height: 40, borderRadius: 20, marginRight: 12, borderWidth: 1, borderColor: '#00E5FF' },
  avatarText: { color: '#00E5FF', fontSize: 16, fontWeight: '900' },
  postMeta: { flex: 1 },
  authorName: { color: '#E6F1FF', fontSize: 15, fontWeight: 'bold' },
  postTime: { color: '#8892B0', fontSize: 11, marginTop: 2, fontWeight: '600' },
  
  postContent: { color: '#E6F1FF', fontSize: 14, lineHeight: 22, marginBottom: 16 },
  
  postFooter: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 14 },
  footerAction: { flexDirection: 'row', alignItems: 'center' },
  actionText: { color: '#8892B0', fontSize: 13, fontWeight: 'bold' },
  
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText: { color: '#E6F1FF', fontSize: 15, fontWeight: 'bold', marginBottom: 6 },
  emptySubText: { color: '#8892B0', fontSize: 13 }
});
