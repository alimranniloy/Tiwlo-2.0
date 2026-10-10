import { applicationFetch as fetch } from '../services/graphqlTransport.js';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';

import { API_BASE_URL } from '../config';
import { COLORS } from '../config/colors';

export default function EventsHubScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const topTheme = getActiveTopBarTheme(isDarkMode);

  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'host'
  const [rsvpMap, setRsvpMap] = useState({});
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Host Event Form
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('Friday, Oct 16 • 07:00 PM');
  const [eventType, setEventType] = useState('Virtual Stream'); // 'Virtual Stream' | 'In-Person Meetup'
  const [eventLocation, setEventLocation] = useState('Tiwi Live Video Stage');
  const [eventDesc, setEventDesc] = useState('');

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/social/events`);
      if (res.ok) {
        const data = await res.json();
        setEvents(Array.isArray(data.events) ? data.events : []);
      } else {
        setEvents([]);
      }
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleToggleRsvp = (eventId, status) => {
    setRsvpMap((prev) => {
      const next = prev[eventId] === status ? null : status;
      Alert.alert(
        'RSVP Updated',
        next === 'going'
          ? 'You are attending this event! Calendar notification set.'
          : next === 'interested'
          ? 'Marked as interested. You will receive updates.'
          : 'RSVP removed.'
      );
      return { ...prev, [eventId]: next };
    });
  };

  const handleHostEvent = async () => {
    if (!eventTitle.trim() || !eventDesc.trim()) {
      Alert.alert('Required Fields', 'Please enter an event title and description.');
      return;
    }

    const newEvent = {
      id: `ev-${Date.now()}`,
      title: eventTitle.trim(),
      host: currentUser?.name || 'You',
      date: eventDate,
      type: eventType,
      location: eventLocation,
      description: eventDesc.trim(),
      attendeesCount: 1,
    };

    try {
      await fetch(`${API_BASE_URL}/api/social/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: eventTitle.trim(),
          host: currentUser?.name || 'You',
          date: eventDate,
          type: eventType,
          location: eventLocation,
          description: eventDesc.trim(),
          creatorId: currentUser?.id,
        }),
      });
    } catch {
      // Handled
    }

    setEvents([newEvent, ...events]);
    setRsvpMap((prev) => ({ ...prev, [newEvent.id]: 'going' }));
    setEventTitle('');
    setEventDesc('');
    setActiveTab('upcoming');
    Alert.alert('Event Published', 'Your community event is now scheduled.');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: topTheme.headerBg, borderBottomColor: topTheme.headerBorder }]}>
        <TouchableOpacity
          onPress={() => onNavigate && onNavigate('back')}
          style={styles.backBtn}
          activeOpacity={0.7}
          hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
        >
          <Ionicons name="arrow-back" size={LAYOUT.HEADER_ICON_SIZE} color={topTheme.headerIconColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Digital Events Hub</Text>
        <TouchableOpacity
          onPress={() => setActiveTab(activeTab === 'host' ? 'upcoming' : 'host')}
          style={[styles.headerActionBtn, { backgroundColor: theme.primary || COLORS.primary }]}
          activeOpacity={0.8}
        >
          <Ionicons name={activeTab === 'host' ? 'close' : 'add'} size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'upcoming' && styles.activeTabBtn]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'upcoming' ? (theme.primary || COLORS.primary) : theme.textSecondary },
              activeTab === 'upcoming' && { fontWeight: '700' },
            ]}
          >
            Upcoming Events
          </Text>
          {activeTab === 'upcoming' && <View style={[styles.tabIndicator, { backgroundColor: theme.primary || COLORS.primary }]} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'host' && styles.activeTabBtn]}
          onPress={() => setActiveTab('host')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'host' ? (theme.primary || COLORS.primary) : theme.textSecondary },
              activeTab === 'host' && { fontWeight: '700' },
            ]}
          >
            Host an Event
          </Text>
          {activeTab === 'host' && <View style={[styles.tabIndicator, { backgroundColor: theme.primary || COLORS.primary }]} />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'host' ? (
          /* HOST EVENT FORM */
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, padding: 18 }]}>
            <View style={styles.hostHeaderRow}>
              <Ionicons name="calendar" size={24} color={theme.primary || COLORS.primary} style={{ marginRight: 8 }} />
              <View>
                <Text style={[styles.hostTitle, { color: theme.text }]}>Host a Community Event</Text>
                <Text style={[styles.hostSub, { color: theme.textSecondary }]}>
                  Organize workshops, live podcasts, and meetups
                </Text>
              </View>
            </View>

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Event Title</Text>
            <TextInput
              style={[
                styles.textInput,
                { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
              ]}
              placeholder="e.g. Masterclass: Scaling PostgreSQL with GraphQL"
              placeholderTextColor={theme.textSecondary}
              value={eventTitle}
              onChangeText={setEventTitle}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>Date & Time</Text>
            <TextInput
              style={[
                styles.textInput,
                { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
              ]}
              placeholder="e.g. Saturday, Nov 14 at 06:00 PM"
              placeholderTextColor={theme.textSecondary}
              value={eventDate}
              onChangeText={setEventDate}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>Location or Stream Link</Text>
            <TextInput
              style={[
                styles.textInput,
                { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
              ]}
              placeholder="e.g. Tiwi Live Audio Room / San Francisco, CA"
              placeholderTextColor={theme.textSecondary}
              value={eventLocation}
              onChangeText={setEventLocation}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>Description</Text>
            <TextInput
              style={[
                styles.textArea,
                { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
              ]}
              placeholder="What will attendees learn or experience?"
              placeholderTextColor={theme.textSecondary}
              value={eventDesc}
              onChangeText={setEventDesc}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.publishEventBtn, { backgroundColor: theme.primary || COLORS.primary }]}
              onPress={handleHostEvent}
              activeOpacity={0.85}
            >
              <Ionicons name="sparkles" size={17} color={COLORS.white} style={{ marginRight: 6 }} />
              <Text style={styles.publishEventBtnText}>Publish Community Event</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.primary || COLORS.primary} />
            <Text style={{ marginTop: 12, color: theme.textSecondary, fontSize: 13 }}>Loading upcoming events...</Text>
          </View>
        ) : events.length === 0 ? (
          <View style={{ padding: 36, alignItems: 'center', backgroundColor: theme.cardBg, borderRadius: 16, borderWidth: 1, borderColor: theme.borderLight, marginTop: 14 }}>
            <Ionicons name="calendar-outline" size={54} color={theme.textSecondary} style={{ opacity: 0.6, marginBottom: 12 }} />
            <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text, marginBottom: 6 }}>No Upcoming Events</Text>
            <Text style={{ fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 18, marginBottom: 18 }}>
              There are no community meetups or live webinars scheduled yet. Be the first to host one!
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: theme.primary || COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}
              onPress={() => setActiveTab('host')}
            >
              <Text style={{ color: COLORS.white, fontWeight: '600', fontSize: 14 }}>Host an Event</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* UPCOMING EVENTS LIST */
          events.map((ev) => {
            const currentRsvp = rsvpMap[ev.id];
            return (
              <View
                key={ev.id}
                style={[styles.eventCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
              >
                {ev.banner && !ev.banner.includes('unsplash') ? (
                  <Image source={{ uri: ev.banner }} style={styles.eventBanner} />
                ) : (
                  <View style={{ height: 110, backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="calendar" size={32} color={theme.primary || COLORS.primary} />
                  </View>
                )}

                <View style={styles.eventContent}>
                  <View style={styles.dateRow}>
                    <Ionicons name="time-outline" size={14} color={COLORS.primary} style={{ marginRight: 4 }} />
                    <Text style={[styles.dateText, { color: COLORS.primary }]}>{ev.date}</Text>
                  </View>

                  <Text style={[styles.eventTitle, { color: theme.text }]}>{ev.title}</Text>
                  <Text style={[styles.eventHostText, { color: theme.textSecondary }]}>Hosted by {ev.host}</Text>

                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={14} color={theme.textSecondary} style={{ marginRight: 4 }} />
                    <Text style={[styles.locationText, { color: theme.textSecondary }]}>{ev.location}</Text>
                  </View>

                  <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

                  {/* Attendees & RSVP Buttons */}
                  <View style={styles.rsvpRow}>
                    <Text style={[styles.attendeeCount, { color: theme.textSecondary }]}>
                      {ev.attendeesCount} attending
                    </Text>

                    <View style={styles.rsvpButtonsGroup}>
                      <TouchableOpacity
                        style={[
                          styles.rsvpBtn,
                          currentRsvp === 'going'
                            ? { backgroundColor: COLORS.hex_10B981 }
                            : { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground },
                        ]}
                        onPress={() => handleToggleRsvp(ev.id, 'going')}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={currentRsvp === 'going' ? 'checkmark' : 'calendar-outline'}
                          size={14}
                          color={currentRsvp === 'going' ? COLORS.white : theme.text}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.rsvpBtnText, { color: currentRsvp === 'going' ? COLORS.white : theme.text }]}>
                          Going
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.rsvpBtn,
                          currentRsvp === 'interested'
                            ? { backgroundColor: COLORS.hex_F59E0B }
                            : { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground },
                        ]}
                        onPress={() => handleToggleRsvp(ev.id, 'interested')}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={currentRsvp === 'interested' ? 'star' : 'star-outline'}
                          size={14}
                          color={currentRsvp === 'interested' ? COLORS.white : theme.text}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.rsvpBtnText, { color: currentRsvp === 'interested' ? COLORS.white : theme.text }]}>
                          Interested
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    height: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabText: {
    fontSize: 13,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 48,
    height: 3,
    borderRadius: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  eventCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 16,
  },
  eventBanner: {
    width: '100%',
    height: 120,
  },
  eventContent: {
    padding: 16,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  eventHostText: {
    fontSize: 12,
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationText: {
    fontSize: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  rsvpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attendeeCount: {
    fontSize: 12,
  },
  rsvpButtonsGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  rsvpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  rsvpBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hostHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  hostTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  hostSub: {
    fontSize: 12,
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  textArea: {
    height: 100,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    fontSize: 14,
  },
  publishEventBtn: {
    flexDirection: 'row',
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  publishEventBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
