import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AlertTriangle, RotateCcw } from 'lucide-react-native';
import { colors } from '../theme/tokens';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  showDetails: boolean;
}

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected runtime exception',
    };
  }

  handleRecover = () => {
    this.setState({
      hasError: false,
      errorMessage: '',
      showDetails: false,
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.page}>
        <View style={styles.center}>
          <View style={styles.iconCircle}>
            <AlertTriangle size={34} strokeWidth={1.9} color={colors.danger} />
          </View>
          <Text style={styles.title}>Something Went Wrong</Text>
          <Text style={styles.desc}>
            Tiwlo caught an unexpected screen error and protected your session data.
          </Text>

          <TouchableOpacity
            style={styles.detailToggle}
            onPress={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
          >
            <Text style={styles.detailToggleText}>
              {this.state.showDetails ? 'Hide Technical Details' : 'View Technical Details'}
            </Text>
          </TouchableOpacity>

          {this.state.showDetails && this.state.errorMessage ? (
            <View style={styles.errorBox}>
              <Text selectable style={styles.errorText}>
                {this.state.errorMessage}
              </Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={this.handleRecover} activeOpacity={0.85}>
          <RotateCcw size={17} strokeWidth={2} color={colors.ink} />
          <Text style={styles.primaryBtnText}>Recover Screen</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 22,
    paddingVertical: 36,
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 21,
    fontWeight: '700',
    color: colors.foreground,
    textAlign: 'center',
  },
  desc: {
    fontSize: 13.5,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 310,
  },
  detailToggle: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  detailToggleText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.muted,
  },
  errorBox: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
  },
  primaryBtn: {
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.ink,
  },
});
