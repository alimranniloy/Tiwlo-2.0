import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

export const Card: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({
  children,
  style,
}) => <View style={[styles.card, style]}>{children}</View>;

export const CardHeader: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({
  children,
  style,
}) => <View style={[styles.cardHeader, style]}>{children}</View>;

export const CardTitle: React.FC<{ children: React.ReactNode; style?: TextStyle }> = ({
  children,
  style,
}) => <Text style={[styles.cardTitle, style]}>{children}</Text>;

export const CardDescription: React.FC<{ children: React.ReactNode; style?: TextStyle }> = ({
  children,
  style,
}) => <Text style={[styles.cardDescription, style]}>{children}</Text>;

export const CardContent: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({
  children,
  style,
}) => <View style={[styles.cardContent, style]}>{children}</View>;

export const CardFooter: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({
  children,
  style,
}) => <View style={[styles.cardFooter, style]}>{children}</View>;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#09090B',
    letterSpacing: -0.3,
  },
  cardDescription: {
    fontSize: 13,
    color: '#71717A',
    marginTop: 2,
    lineHeight: 18,
  },
  cardContent: {
    // Content container
  },
  cardFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F4F4F5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
