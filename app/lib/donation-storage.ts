import { Donation } from '@/app/types';
import { generateQRCode } from './utils';
import { LocationService } from './location-service';

// Helper function to safely access localStorage
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.error('Error accessing localStorage:', error);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.error('Error setting localStorage:', error);
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
    }
  }
};

class DonationStorageService {
  private readonly STORAGE_KEY = 'zeroFoodHero_donations';
  private inMemoryStorage: Record<string, string> = {};

  // Get all stored donations
  private getStoredDonations(): Donation[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = safeLocalStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      
      const donations = JSON.parse(stored);
      // Convert date strings back to Date objects
      return donations.map((donation: any) => {
        const createdAt = new Date(donation.createdAt);
        const updatedAt = new Date(donation.updatedAt);
        const expiry = new Date(donation.expiry);
        
        // Validate dates and provide fallbacks for invalid dates
        return {
          ...donation,
          createdAt: isNaN(createdAt.getTime()) ? new Date() : createdAt,
          updatedAt: isNaN(updatedAt.getTime()) ? new Date() : updatedAt,
          expiry: isNaN(expiry.getTime()) ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : expiry // Default to 7 days from now
        };
      });
    } catch (error) {
      console.error('Error parsing stored donations:', error);
      return [];
    }
  }

  // Save all donations to storage
  private saveDonations(donations: Donation[]): void {
    try {
      // Ensure we're only saving serializable data
      const serializableDonations = donations.map(donation => ({
        ...donation,
        // Convert Date objects to ISO strings for serialization
        createdAt: donation.createdAt.toISOString(),
        updatedAt: donation.updatedAt.toISOString(),
        expiry: donation.expiry ? donation.expiry.toISOString() : null,
        // Ensure any other Date objects are also converted
        ...(donation.pickupTime && { pickupTime: donation.pickupTime.toISOString() })
      }));
      
      safeLocalStorage.setItem(this.STORAGE_KEY, JSON.stringify(serializableDonations));
    } catch (error) {
      console.error('Error saving donations:', error);
    }
  }

  // Get all donations (automatically removes expired ones)
  public getAllDonations(): Donation[] {
    const donations = this.getStoredDonations();
    const now = new Date();
    
    // Filter out expired donations and update their status
    const validDonations: Donation[] = [];
    let hasExpired = false;
    
    donations.forEach(donation => {
      const expiryDate = new Date(donation.expiry);
      if (expiryDate < now && donation.status === 'available') {
        // Auto-expire available donations
        donation.status = 'expired';
        hasExpired = true;
      }
      
      // Only return non-expired donations (or expired ones that are already in transit/delivered)
      if (donation.status !== 'expired' || 
          donation.status === 'in_transit' || 
          donation.status === 'picked' || 
          donation.status === 'delivered') {
        validDonations.push(donation);
      }
    });
    
    // Save updated donations if any expired
    if (hasExpired) {
      this.saveDonations(donations);
    }
    
    return validDonations;
  }

  // Get donations by status
  public getDonationsByStatus(status: string): Donation[] {
    const donations = this.getStoredDonations();
    return donations.filter(donation => donation.status === status);
  }

  // Get donations by donor ID
  public getDonationsByDonor(donorId: string): Donation[] {
    const donations = this.getStoredDonations();
    return donations.filter(donation => donation.donorId === donorId);
  }

  // Add a new donation
  public addDonation(donation: Donation): void {
    const donations = this.getStoredDonations();
    donations.unshift(donation); // Add to beginning of array
    this.saveDonations(donations);
  }

  // Update a donation
  public updateDonation(donationId: string, updates: Partial<Donation>): void {
    const donations = this.getStoredDonations();
    const index = donations.findIndex(d => d.id === donationId);
    
    if (index !== -1) {
      donations[index] = {
        ...donations[index],
        ...updates,
        updatedAt: new Date()
      };
      this.saveDonations(donations);
    }
  }

  // Delete a donation
  public deleteDonation(donationId: string): void {
    const donations = this.getStoredDonations();
    const filteredDonations = donations.filter(d => d.id !== donationId);
    this.saveDonations(filteredDonations);
  }

  // Get donation by ID
  public getDonationById(donationId: string): Donation | null {
    const donations = this.getStoredDonations();
    return donations.find(d => d.id === donationId) || null;
  }

  // Get nearby donations (within specified radius in km or by address match)
  public getNearbyDonations(lat: number, lng: number, radiusKm: number = 10, address?: string): Donation[] {
    const donations = this.getStoredDonations();
    
    return donations
      .map(donation => ({
        ...donation,
        distance: this.calculateDistance(lat, lng, donation.location.lat, donation.location.lng)
      }))
      .filter(donation => {
        // If address is provided, also check for address matching
        if (address && donation.location?.address) {
          if (LocationService.addressesMatch(address, donation.location.address)) {
            return true; // Match by address even if outside radius
          }
        }
        // Otherwise filter by distance
        return donation.distance <= radiusKm;
      })
      .sort((a, b) => a.distance - b.distance);
  }

  // Get donations by address (fuzzy matching)
  public getDonationsByAddress(searchAddress: string): Donation[] {
    const donations = this.getStoredDonations();
    
    return donations.filter(donation => {
      if (!donation.location?.address) return false;
      return LocationService.addressesMatch(searchAddress, donation.location.address);
    });
  }

  // Calculate distance between two points using Haversine formula
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  // Clear all donations (for testing/reset)
  public clearAllDonations(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.STORAGE_KEY);
  }

  // Update QR codes for existing donations (migration function)
  public updateQRCodes(): void {
    if (typeof window === 'undefined') return;
    
    const donations = this.getStoredDonations();
    let updated = false;
    
    donations.forEach(donation => {
      // Check if QR code is in old JSON format
      if (donation.qrCode && donation.qrCode.includes('"title"')) {
        // Update to new URL format
        donation.qrCode = generateQRCode(donation.id);
        updated = true;
      }
    });
    
    if (updated) {
      this.saveDonations(donations);
      console.log('Updated QR codes for existing donations');
    }
  }
}

// Export singleton instance
export const donationStorage = new DonationStorageService(); 