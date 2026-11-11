import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, StatusBar, Modal, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { encryptMessage, decryptMessage } from '../lib/e2eEncryption';
import MessageBubble, { MessageItem } from '../components/MessageBubble';
import GifPickerModal from '../components/GifPickerModal';

export default function GroupChatScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { roomId, groupName } = route.params;

  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [groupData, setGroupData] = useState<any>(null);
  const [currentGroupName, setCurrentGroupName] = useState(groupName || 'Chat di Gruppo');

  // Stati per il Modale Custom di Rinomina Gruppo (Task)
  const [isRenameModalVisible, setRenameModalVisible] = useState(false);
  const [newNameInput, setNewNameInput] = useState('');

  const [gifModalVisible, setGifModalVisible] = useState(false);
  const [viewOnceModalVisible, setViewOnceModalVisible] = useState(false);
  const [selectedViewOnceItem, setSelectedViewOnceItem] = useState<MessageItem | null>(null);
  const [isViewOnceMode, setIsViewOnceMode] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const typingTimeoutRef = useRef<any>(null);
  const lastTypingSentRef = useRef(0);
  const channelRef = useRef<any>(null);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    let sub: any;
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data: roomInfo } = await supabase.from('group_rooms').select('*').eq('id', roomId).maybeSingle();
      if (roomInfo) {
        setGroupData(roomInfo);
        if (roomInfo.name) setCurrentGroupName(roomInfo.name);
      }

      const { data } = await supabase
        .from('group_messages')
        .select('*, profiles(username, avatar_url)')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (data) {
        setMessages(data.map((m: any) => ({
          ...m,
          content: m.media_type === 'gif' ? m.content : decryptMessage(m.content, roomId)
        })));
      }

      await supabase
        .from('group_messages')
        .update({ is_read: true })
        .eq('room_id', roomId)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      sub = supabase
        .channel(`group:${roomId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `room_id=eq.${roomId}` }, async (payload) => {
          const { data: profile } = await supabase.from('profiles').select('username, avatar_url').eq('id', payload.new.sender_id).single();
          const newMsg: MessageItem = {
            ...(payload.new as any),
            profiles: profile,
            content: payload.new.media_type === 'gif' ? payload.new.content : decryptMessage(payload.new.content, roomId)
          };

          if (newMsg.sender_id !== user.id) {
            newMsg.is_read = true;
            await supabase
              .from('group_messages')
              .update({ is_read: true })
              .eq('id', newMsg.id);
          }

          setMessages(prev => {
            if (prev.some(msg => msg.id === newMsg.id)) {
              return prev;
            }
            return [...prev, newMsg];
          });
        })
        .on('broadcast', { event: 'typing' }, (payload) => {
          if (payload.payload?.userId !== user.id) {
            setIsTyping(true);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
              setIsTyping(false);
            }, 3000);
          }
        })
        .subscribe();

      channelRef.current = sub;
    };
    init();
    return () => { if (sub) supabase.removeChannel(sub); };
  }, [roomId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleTextChange = (text: string) => {
    setInputText(text);
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2000 && currentUserId && channelRef.current) {
      lastTypingSentRef.current = now;
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUserId }
      });
    }
  };

  const sendMessage = async (mediaUrl?: string, mediaType: string = 'text') => {
    if (!currentUserId) return;
    if (mediaType === 'text' && !inputText.trim()) return;

    const textPayload = mediaType === 'gif' ? (inputText.trim() || 'GIF') : inputText.trim();
    const encryptedContent = mediaType === 'gif' ? textPayload : encryptMessage(textPayload, roomId);

    const messageData = {
      room_id: roomId,
      sender_id: currentUserId,
      content: encryptedContent,
      media_type: mediaType,
      media_url: mediaUrl || null,
      is_view_once: isViewOnceMode
    };

    const { data, error } = await supabase.from('group_messages').insert(messageData).select('*, profiles(username, avatar_url)').single();

    if (!error && data) {
      const decryptedMsg: MessageItem = {
        ...data,
        content: mediaType === 'gif' ? data.content : textPayload
      };
      setMessages(prev => {
        if (prev.some(msg => msg.id === decryptedMsg.id)) {
          return prev;
        }
        return [...prev, decryptedMsg];
      });
      setInputText('');
      setIsViewOnceMode(false);
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  };

  const sendGif = (gifUrl: string) => {
    setGifModalVisible(false);
    sendMessage(gifUrl, 'gif');
  };

  const handleOpenViewOnce = (item: MessageItem) => {
    setSelectedViewOnceItem(item);
    setViewOnceModalVisible(true);
  };

  const getMessagesWithDateHeaders = (msgs: MessageItem[]) => {
    const list: any[] = [];
    let lastDateStr = '';

    msgs.forEach(msg => {
      const d = new Date(msg.created_at);
      const dateStr = d.toLocaleDateString();
      if (dateStr !== lastDateStr) {
        list.push({ isDateHeader: true, id: `date-${dateStr}`, dateString: dateStr });
        lastDateStr = dateStr;
      }
      list.push(msg);
    });

    return list;
  };

  const isGroupHost = currentUserId && groupData && (currentUserId === groupData.host_id || currentUserId === groupData.created_by || currentUserId === groupData.admin_id);

  const handleRenameGroup = () => {
    setNewNameInput(currentGroupName);
    setRenameModalVisible(true);
  };

  const submitRenameGroup = async () => {
    if (!newNameInput.trim()) return;
    try {
      const { error } = await supabase.from('group_rooms').update({ name: newNameInput.trim() }).eq('id', roomId);
      if (error) throw error;
      setCurrentGroupName(newNameInput.trim());
      setRenameModalVisible(false);
      setNewNameInput('');
    } catch (err: any) {
      alert("Errore rinomina gruppo: " + (err?.message || "Errore"));
    }
  };

  const handleAdminDeleteGroup = () => {
    Alert.alert(
      "ELIMINA GRUPPO",
      "Sei sicuro di voler eliminare questa chat di gruppo per tutti i partecipanti?",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "ELIMINA",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase.rpc('delete_group_room_if_admin', { room_id_param: roomId });
              if (error) throw error;
              navigation.navigate('ChatHub');
            } catch (err: any) {
              alert("Errore eliminazione gruppo: " + (err?.message || "Errore"));
            }
          }
        }
      ]
    );
  };

  const handleParticipantLeaveGroup = () => {
    Alert.alert(
      "ESCI DAL GRUPPO",
      "Sei sicuro di voler uscire da questa chat di gruppo?",
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "ESCI",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase.rpc('leave_group_room', { room_id_param: roomId });
              if (error) throw error;
              navigation.navigate('ChatHub');
            } catch (err: any) {
              alert("Errore uscita gruppo: " + (err?.message || "Errore"));
            }
          }
        }
      ]
    );
  };

  const theme = {
    bg: '#050B14',
    headerBg: '#121624',
    border: '#233554',
    text: '#FFFFFF',
    subText: '#8892B0',
    inputBg: '#121624',
    accent: '#00E5FF',
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.accent} />
        </TouchableOpacity>

        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>{(currentGroupName || 'G').charAt(0).toUpperCase()}</Text>
        </View>

        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>{currentGroupName}</Text>
          <Text style={[styles.headerStatus, { color: theme.accent }]}>gruppo protetto • E2EE</Text>
        </View>

        {isGroupHost ? (
          <View style={{ flexDirection: 'row', gap: 6, marginLeft: 8 }}>
            <TouchableOpacity onPress={handleRenameGroup} style={styles.hostHeaderBtn}>
              <Ionicons name="pencil" size={15} color={theme.accent} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleAdminDeleteGroup} style={styles.hostHeaderBtn}>
              <Ionicons name="trash" size={15} color="#FF0055" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={handleParticipantLeaveGroup} style={styles.hostHeaderBtn}>
            <Ionicons name="exit-outline" size={18} color="#FF8800" />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.keyboardView}
      >
        <FlatList
          ref={flatListRef}
          data={getMessagesWithDateHeaders(messages)}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => {
            if (item.isDateHeader) {
              return (
                <View style={{ alignItems: 'center', marginVertical: 12 }}>
                  <View style={{ backgroundColor: 'rgba(0, 229, 255, 0.1)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.2)' }}>
                    <Text style={{ color: '#00E5FF', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>{item.dateString}</Text>
                  </View>
                </View>
              );
            }
            return (
              <MessageBubble 
                item={item} 
                currentUserId={currentUserId} 
                senderName={item.profiles?.username} 
                onOpenViewOnce={handleOpenViewOnce}
              />
            );
          }}
          contentContainerStyle={styles.chatList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 100, flex: 1 }}>
              <Text style={{ color: theme.subText, fontSize: 14, fontStyle: 'italic', letterSpacing: 0.5 }}>Scrivi un messaggio</Text>
            </View>
          }
        />

        {/* Typing indicator */}
        {isTyping && (
          <View style={styles.typingContainer}>
            <Text style={styles.typingText}>L'agente sta scrivendo...</Text>
          </View>
        )}

        {/* Input Bar */}
        <View style={[styles.inputBar, { backgroundColor: theme.inputBg, borderTopColor: theme.border }]}>
          {/* 1-Time Photo Toggle */}
          <TouchableOpacity 
            style={[styles.actionIconButton, isViewOnceMode && { backgroundColor: 'rgba(255, 215, 0, 0.2)', borderColor: '#FFD700' }]} 
            onPress={() => setIsViewOnceMode(!isViewOnceMode)}
            activeOpacity={0.8}
          >
            <Ionicons name="flash" size={18} color={isViewOnceMode ? '#FFD700' : theme.subText} />
          </TouchableOpacity>

          {/* GIF Picker Button */}
          <TouchableOpacity 
            style={styles.actionIconButton} 
            onPress={() => setGifModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="image-outline" size={20} color={theme.accent} />
          </TouchableOpacity>

          <TextInput
            style={[styles.textInput, { color: theme.text, backgroundColor: '#050B14' }]}
            placeholder={isViewOnceMode ? "Scrivi foto 1-Time nel gruppo..." : "Scrivi nel gruppo..."}
            placeholderTextColor={theme.subText}
            value={inputText}
            onChangeText={handleTextChange}
            multiline
          />

          <TouchableOpacity 
            style={[styles.sendButton, (!inputText.trim() && !isViewOnceMode) && { opacity: 0.5 }, { backgroundColor: theme.accent }]} 
            onPress={() => sendMessage()}
            activeOpacity={0.85}
            disabled={!inputText.trim() && !isViewOnceMode}
          >
            <Ionicons name="send" size={18} color="#050B14" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* GIF Picker Modal */}
      <GifPickerModal
        visible={gifModalVisible}
        onClose={() => setGifModalVisible(false)}
        onSelectGif={sendGif}
      />

      {/* View-Once Photo Modal */}
      <Modal visible={viewOnceModalVisible} transparent animationType="fade">
        <View style={styles.modalDarkOverlay}>
          <View style={styles.viewOnceModalContent}>
            <Text style={styles.viewOnceModalTitle}>FOTO 1-TIME (AUTODISTRUZIONE)</Text>
            {selectedViewOnceItem?.media_url ? (
              <Image source={{ uri: selectedViewOnceItem.media_url }} style={styles.viewOnceFullImage} resizeMode="contain" />
            ) : (
              <Text style={{ color: '#FFF', fontSize: 16 }}>{selectedViewOnceItem?.content}</Text>
            )}
            <TouchableOpacity 
              style={styles.closeViewOnceBtn}
              onPress={() => { setViewOnceModalVisible(false); setSelectedViewOnceItem(null); }}
            >
              <Text style={styles.closeViewOnceText}>CHIUDI E DISTRUGGI</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Custom Rename Modal (Cross-Platform) */}
      <Modal visible={isRenameModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.customModalCard}>
            <Text style={styles.customModalTitle}>RINOMINA GRUPPO</Text>
            <TextInput
              style={styles.customModalInput}
              placeholder="Nuovo nome gruppo..."
              placeholderTextColor="#8892B0"
              value={newNameInput}
              onChangeText={setNewNameInput}
              maxLength={40}
            />
            <View style={styles.customModalBtnRow}>
              <TouchableOpacity style={styles.customModalCancelBtn} onPress={() => setRenameModalVisible(false)}>
                <Text style={styles.customModalCancelText}>ANNULLA</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.customModalSaveBtn} onPress={submitRenameGroup}>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: { marginRight: 12 },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#050B14',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00E5FF',
    marginRight: 12,
  },
  headerAvatarText: { color: '#00E5FF', fontSize: 16, fontWeight: 'bold' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: 'bold' },
  headerStatus: { fontSize: 11 },
  hostHeaderBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#233554' },

  keyboardView: { flex: 1, justifyContent: 'space-between' },
  chatList: { paddingVertical: 16 },
  typingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  typingText: { color: '#00E5FF', fontSize: 11, fontStyle: 'italic' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  actionIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#233554',
  },
  textInput: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 100,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#233554',
    marginRight: 8,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDarkOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 10, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  viewOnceModalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#121624',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFD700',
  },
  viewOnceModalTitle: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 20,
  },
  viewOnceFullImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: '#000',
  },
  closeViewOnceBtn: {
    backgroundColor: '#FF0055',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  closeViewOnceText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1,
  },

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
