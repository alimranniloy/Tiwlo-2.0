import React from 'react';
import { Image } from 'react-native';
import {
  Ionicons,
  Feather,
  MaterialCommunityIcons,
  FontAwesome5,
} from '@expo/vector-icons';

export type IconName =
  | 'pick-logo'
  | 'food'
  | 'groceries'
  | 'parcel'
  | 'pickup'
  | 'location-pin'
  | 'check'
  | 'edit'
  | 'back'
  | 'heart'
  | 'heart-filled'
  | 'search'
  | 'bell'
  | 'profile'
  | 'star'
  | 'scooter'
  | 'store'
  | 'business'
  | 'track'
  | 'phone'
  | 'chat'
  | 'apple'
  | 'google'
  | 'facebook'
  | 'chevron-right'
  | 'home'
  | 'home-active'
  | 'orders'
  | 'orders-active'
  | 'scan'
  | 'wallet'
  | 'wallet-active'
  | 'profile-active'
  | 'clock'
  | 'more'
  | 'cart'
  | 'plus'
  | 'minus'
  | 'package'
  | 'navigate'
  | 'receipt'
  | 'shield'
  | 'help'
  | 'settings'
  | 'logout'
  | 'tag'
  | 'refresh'
  | 'sun'
  | 'moon'
  | 'car'
  | 'truck'
  | 'lock'
  | 'camera'
  | 'file-text'
  | 'map-pin'
  | 'info'
  | 'mail'
  | 'share'
  | 'credit-card'
  | 'card'
  | 'close'
  | 'arrow-right'
  | 'arrow-up'
  | 'arrow-down';

interface PickIconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export const PickIcon: React.FC<PickIconProps> = ({
  name,
  size = 22,
  color = '#111827',
}) => {
  switch (name) {
    case 'pick-logo':
      return (
        <Image
          source={
            color === '#FFFFFF' || color === '#FFF'
              ? require('../../../assets/logos/icon-light.png')
              : require('../../../assets/logos/icon-black.png')
          }
          style={{ width: size, height: size }}
          resizeMode="contain"
        />
      );

    case 'back':
      return <Ionicons name="arrow-back" size={size} color={color} />;

    case 'chevron-right':
      return <Feather name="chevron-right" size={size} color={color} />;

    case 'search':
      return <Feather name="search" size={size} color={color} />;

    case 'bell':
      return <Ionicons name="notifications-outline" size={size} color={color} />;

    case 'profile':
      return <Ionicons name="person-outline" size={size} color={color} />;

    case 'profile-active':
      return <Ionicons name="person" size={size} color={color} />;

    case 'location-pin':
      return <Ionicons name="location-sharp" size={size} color={color} />;

    case 'check':
      return <Ionicons name="checkmark-sharp" size={size} color={color} />;

    case 'edit':
      return <Feather name="edit-2" size={size} color={color} />;

    case 'heart':
      return <Ionicons name="heart-outline" size={size} color={color} />;

    case 'heart-filled':
      return <Ionicons name="heart" size={size} color="#EF4444" />;

    case 'star':
      return <Ionicons name="star" size={size} color="#F59E0B" />;

    case 'food':
      return (
        <MaterialCommunityIcons
          name="silverware-fork-knife"
          size={size}
          color={color}
        />
      );

    case 'groceries':
      return <Feather name="shopping-bag" size={size} color={color} />;

    case 'parcel':
    case 'package':
      return <Feather name="box" size={size} color={color} />;

    case 'pickup':
    case 'scooter':
      return (
        <MaterialCommunityIcons name="moped" size={size} color={color} />
      );

    case 'store':
      return (
        <MaterialCommunityIcons
          name="storefront-outline"
          size={size}
          color={color}
        />
      );

    case 'business':
      return <Feather name="briefcase" size={size} color={color} />;

    case 'track':
    case 'receipt':
      return (
        <MaterialCommunityIcons
          name="clipboard-text-search-outline"
          size={size}
          color={color}
        />
      );

    case 'clock':
      return <Feather name="clock" size={size} color={color} />;

    case 'phone':
      return <Ionicons name="call" size={size} color={color} />;

    case 'chat':
      return (
        <Ionicons name="chatbubble-ellipses" size={size} color={color} />
      );

    case 'apple':
      return <FontAwesome5 name="apple" size={size} color={color} />;

    case 'google':
      return <FontAwesome5 name="google" size={size} color="#EA4335" />;

    case 'facebook':
      return <FontAwesome5 name="facebook-f" size={size} color="#1877F2" />;

    case 'home':
      return <Ionicons name="home-outline" size={size} color={color} />;

    case 'home-active':
      return <Ionicons name="home" size={size} color={color} />;

    case 'orders':
      return <Ionicons name="receipt-outline" size={size} color={color} />;

    case 'orders-active':
      return <Ionicons name="receipt" size={size} color={color} />;

    case 'scan':
      return <Ionicons name="scan-outline" size={size} color={color} />;

    case 'wallet':
      return <Ionicons name="wallet-outline" size={size} color={color} />;

    case 'wallet-active':
      return <Ionicons name="wallet" size={size} color={color} />;

    case 'cart':
      return <Feather name="shopping-cart" size={size} color={color} />;

    case 'more':
      return <Ionicons name="ellipsis-vertical" size={size} color={color} />;

    case 'plus':
      return <Feather name="plus" size={size} color={color} />;

    case 'minus':
      return <Feather name="minus" size={size} color={color} />;

    case 'navigate':
      return <Ionicons name="navigate" size={size} color={color} />;

    case 'shield':
      return <Feather name="shield" size={size} color={color} />;

    case 'help':
      return <Feather name="help-circle" size={size} color={color} />;

    case 'settings':
      return <Feather name="settings" size={size} color={color} />;

    case 'logout':
      return <Feather name="log-out" size={size} color={color} />;

    case 'tag':
      return <Feather name="tag" size={size} color={color} />;

    case 'refresh':
      return <Feather name="rotate-cw" size={size} color={color} />;

    case 'sun':
      return <Feather name="sun" size={size} color={color} />;

    case 'moon':
      return <Feather name="moon" size={size} color={color} />;

    case 'car':
      return <MaterialCommunityIcons name="car" size={size} color={color} />;

    case 'truck':
      return <MaterialCommunityIcons name="truck-delivery" size={size} color={color} />;

    case 'lock':
      return <Feather name="lock" size={size} color={color} />;

    case 'camera':
      return <Feather name="camera" size={size} color={color} />;

    case 'file-text':
      return <Feather name="file-text" size={size} color={color} />;

    case 'map-pin':
      return <Feather name="map-pin" size={size} color={color} />;

    case 'info':
      return <Feather name="info" size={size} color={color} />;

    case 'mail':
      return <Feather name="mail" size={size} color={color} />;

    case 'share':
      return <Feather name="share-2" size={size} color={color} />;

    case 'credit-card':
    case 'card':
      return <Feather name="credit-card" size={size} color={color} />;

    case 'close':
      return <Feather name="x" size={size} color={color} />;

    case 'arrow-right':
      return <Feather name="arrow-right" size={size} color={color} />;

    case 'arrow-up':
      return <Feather name="arrow-up" size={size} color={color} />;

    case 'arrow-down':
      return <Feather name="arrow-down" size={size} color={color} />;

    default:
      return <Feather name="circle" size={size} color={color} />;
  }
};
