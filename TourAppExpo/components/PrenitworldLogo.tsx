import React from 'react';
import { View, Text, StyleSheet, Image, useColorScheme } from 'react-native';

interface PrenitworldLogoProps {
  size?: 'small' | 'medium' | 'large';
  showTagline?: boolean;
}

export default function PrenitworldLogo({ size = 'medium', showTagline = true }: PrenitworldLogoProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          container: { height: 60 },
          logoImage: { width: 180, height: 60 },
          logoText: { fontSize: 20 },
          taglineText: { fontSize: 12 },
          pSymbol: { width: 32, height: 32 }
        };
      case 'large':
        return {
          container: { height: 120 },
          logoImage: { width: 360, height: 120 },
          logoText: { fontSize: 40 },
          taglineText: { fontSize: 20 },
          pSymbol: { width: 64, height: 64 }
        };
      default: // medium
        return {
          container: { height: 90 },
          logoImage: { width: 270, height: 90 },
          logoText: { fontSize: 30 },
          taglineText: { fontSize: 16 },
          pSymbol: { width: 48, height: 48 }
        };
    }
  };

  const sizeStyles = getSizeStyles();

  // Try to use image, fallback to custom drawn logo
  try {
    return (
      <View style={[styles.container, sizeStyles.container]}>
        <View style={styles.logoContainer}>
          {/* Logo Image */}
          {isDark ? (
            <View style={[styles.darkWrapper, size === 'large' ? styles.darkWrapperLg : size === 'small' ? styles.darkWrapperSm : styles.darkWrapperMd]}>
              <Image 
                source={require('../assets/images/prenitworld-logo.png')}
                style={[styles.logoImage, sizeStyles.logoImage]}
                resizeMode="contain"
              />
            </View>
          ) : (
            <Image 
              source={require('../assets/images/prenitworld-logo.png')}
              style={[styles.logoImage, sizeStyles.logoImage]}
              resizeMode="contain"
            />
          )}
          
          {/* Tagline (if enabled) */}
         
        </View>
      </View>
    );
  } catch {
    // Fallback to custom drawn logo if image not found
    return (
      <View style={[styles.container, sizeStyles.container]}>
        <View style={styles.logoContainer}>
          {/* P Symbol */}
          <View style={[styles.pSymbol, sizeStyles.pSymbol]}>
            <View style={styles.pOuter}>
              <View style={styles.pInner} />
            </View>
          </View>
          
          {/* Text */}
          <View style={styles.textContainer}>
            <View style={styles.mainTextContainer}>
              <Text style={[styles.logoText, styles.prenitText, sizeStyles.logoText]}>prenit</Text>
              <Text style={[styles.logoText, styles.worldText, sizeStyles.logoText]}>world</Text>
            </View>
            {showTagline && (
              <Text style={[styles.taglineText, sizeStyles.taglineText]}>LIFECARE</Text>
            )}
          </View>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    // Dimensions will be set dynamically based on size
  },
  // In dark mode, place the logo on a light chip so black text stays visible
  darkWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  darkWrapperSm: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  darkWrapperMd: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  darkWrapperLg: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  // Fallback logo styles
  pSymbol: {
    marginRight: 12,
  },
  pOuter: {
    width: '100%',
    height: '100%',
    backgroundColor: '#009c8e',
    position: 'relative',
    borderRadius: 4,
  },
  pInner: {
    position: 'absolute',
    top: '20%',
    left: '20%',
    width: '60%',
    height: '60%',
    backgroundColor: '#007a6e',
    borderRadius: 2,
  },
  textContainer: {
    alignItems: 'flex-start',
  },
  mainTextContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  logoText: {
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  prenitText: {
    color: '#007a6e',
  },
  worldText: {
    color: '#009c8e',
  },
  taglineText: {
    color: '#333',
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 4,
    textAlign: 'center',
  },
});
