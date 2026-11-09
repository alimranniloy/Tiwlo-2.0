import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Header } from '../components/common/Header';
import { BottomNav } from '../components/common/BottomNav';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';
import { AnimatedEmptyState } from '../components/common/AnimatedEmptyState';
import { useLanguage } from '../context/LanguageContext';
import type { PickOrder } from '../services/orders';

interface OrdersScreenProps {
  onBack: () => void;
  orders: PickOrder[];
  loading: boolean;
  onTrackOrder: (orderId: string) => void;
  onReorder: (order: PickOrder) => void;
  onTabPress: (tab: string) => void;
}

export const OrdersScreen: React.FC<OrdersScreenProps> = ({
  onBack,
  orders,
  loading,
  onTrackOrder,
  onReorder,
  onTabPress,
}) => {
  const { language, t } = useLanguage();
  const isEn = language === 'en';

  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');
  const activeOrders = orders.filter((order) =>
    !['delivered', 'cancelled', 'canceled', 'failed', 'payment_failed', 'refunded'].includes(order.status.toLowerCase())
  );
  const pastOrders = orders.filter((order) => !activeOrders.includes(order));
  const visibleOrders = activeTab === 'active' ? activeOrders : pastOrders;
  const formatStatus = (status: string) =>
    status.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const formatItems = (order: PickOrder) => order.items.map((item) =>
    `${isEn ? item.nameEn : item.nameBn} (${item.quantity} ${isEn ? item.unitEn : item.unitBn})`
  ).join(', ') || (
    order.parcelDetails
      ? `${isEn ? order.parcelDetails.package?.categoryName || 'Parcel' : order.parcelDetails.package?.categoryName || 'পার্সেল'}${
        order.parcelDetails.recipient?.address ? ` • ${order.parcelDetails.recipient.address}` : ''
      }`
      : ''
  );

  return (
    <ScreenContainer applyTopInset applyBottomInset={false}>
      <Header title={t('Orders', 'অর্ডার')} onBack={onBack} />

      {/* Clean Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.tabActive]}
          onPress={() => setActiveTab('active')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'active' && styles.tabTextActive,
            ]}
          >
            {t('Active', 'চলমান')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.tabActive]}
          onPress={() => setActiveTab('past')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'past' && styles.tabTextActive,
            ]}
          >
            {t('Past Orders', 'পূর্বের অর্ডার')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Orders List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: SYSTEM_INSETS.bottomNavPadding + 20 },
        ]}
      >
        {loading ? (
          <Text style={styles.orderItems}>{t('Loading orders...', 'অর্ডার লোড হচ্ছে...')}</Text>
        ) : visibleOrders.length === 0 ? (
          <AnimatedEmptyState
            animation="orders"
            title={activeTab === 'active'
              ? t('No active orders', 'কোনো চলমান অর্ডার নেই')
              : t('No past orders yet', 'এখনো কোনো আগের অর্ডার নেই')}
            description={activeTab === 'active'
              ? t(
                'When you place an order, you can follow its progress here.',
                'অর্ডার করলে তার অগ্রগতি এখানে দেখতে পাবেন।'
              )
              : t(
                'Your completed orders will be saved here.',
                'আপনার সম্পন্ন অর্ডারগুলো এখানে দেখা যাবে।'
              )}
            actionLabel={t('Browse products', 'পণ্য দেখুন')}
            onAction={() => onTabPress('home')}
          />
        ) : visibleOrders.map((order, index) => {
          const isLast = index === visibleOrders.length - 1;
          const title = order.orderType === 'parcel'
            ? t('Parcel delivery', 'পার্সেল ডেলিভারি')
            : t('Grocery order', 'গ্রোসারি অর্ডার');
          const createdAt = new Date(order.createdAt);
          const date = Number.isNaN(createdAt.getTime())
            ? order.createdAt
            : createdAt.toLocaleString(isEn ? 'en-BD' : 'bn-BD');
          return (
            <View
              key={order.id}
              style={[styles.orderRow, !isLast && styles.hairlineDivider]}
            >
              <View style={styles.orderHeader}>
                <Text style={styles.orderTitle}>{title}</Text>
                <Text style={styles.orderPrice}>৳{order.total}</Text>
              </View>
              <Text style={styles.orderItems}>
                {formatItems(order) || order.deliveryAddress}
              </Text>
              <Text style={styles.orderDate}>
                {formatStatus(order.status)} • {date}
              </Text>
              {order.paymentMethod.toLowerCase() !== 'cod' ? (
                <Text style={styles.orderDate}>
                  {t('Payment', 'পেমেন্ট')}: {formatStatus(order.paymentStatus)}
                </Text>
              ) : null}
              {activeTab === 'active' ? (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => onTrackOrder(order.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionBtnText}>
                    {t('View Order Status', 'অর্ডারের অবস্থা দেখুন')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.secondaryActionBtn}
                  onPress={() => onReorder(order)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryActionBtnText}>
                    {t('Reorder', 'আবার অর্ডার')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Bottom Nav */}
      <BottomNav
        activeTab="orders"
        onTabPress={onTabPress}
        onCenterPress={() => onTabPress('parcel')}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E4E7',
    paddingHorizontal: 20,
    gap: 24,
  },
  tab: {
    paddingVertical: 12,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#09090B',
  },
  tabText: {
    fontSize: 15,
    color: '#71717A',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#09090B',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  orderRow: {
    paddingVertical: 18,
  },
  hairlineDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E4E7',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#09090B',
  },
  orderPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#09090B',
  },
  orderItems: {
    fontSize: 13,
    color: '#71717A',
    marginBottom: 4,
    lineHeight: 18,
  },
  orderEta: {
    fontSize: 13,
    color: '#09090B',
    fontWeight: '600',
    marginBottom: 12,
  },
  orderDate: {
    fontSize: 12,
    color: '#71717A',
    marginBottom: 12,
  },
  actionBtn: {
    height: 44,
    backgroundColor: '#09090B',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryActionBtn: {
    height: 44,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#09090B',
  },
});
