import { Timestamp } from 'firebase/firestore';

/**
 * Format a Date object to YYYY-MM-DD in local time
 */
export const formatDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get current time string as HH:MM:SS
 */
export const formatTimeString = (date: Date): string => {
  return date.toTimeString().split(' ')[0];
};

/**
 * Format Firestore Timestamp or Date to readable string
 */
export const formatReadableDateTime = (timestamp: any): string => {
  if (!timestamp) return '-';
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString();
};

/**
 * Format date string YYYY-MM-DD to readable date DD-MM-YYYY
 */
export const formatReadableDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

/**
 * Get start and end dates for a filter type
 */
export const getDateRange = (filterType: string, customRange?: { startDate: string; endDate: string }): { start: string; end: string } => {
  const today = new Date();
  
  switch (filterType) {
    case 'today': {
      const todayStr = formatDateString(today);
      return { start: todayStr, end: todayStr };
    }
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = formatDateString(yesterday);
      return { start: yesterdayStr, end: yesterdayStr };
    }
    case 'this_week': {
      // Monday to Sunday
      const startOfWeek = new Date(today);
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      startOfWeek.setDate(diff);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      
      return {
        start: formatDateString(startOfWeek),
        end: formatDateString(endOfWeek)
      };
    }
    case 'last_week': {
      const startOfThisWeek = new Date(today);
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      startOfThisWeek.setDate(diff);

      const startOfLastWeek = new Date(startOfThisWeek);
      startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

      const endOfLastWeek = new Date(startOfLastWeek);
      endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);

      return {
        start: formatDateString(startOfLastWeek),
        end: formatDateString(endOfLastWeek)
      };
    }
    case 'this_month': {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return {
        start: formatDateString(startOfMonth),
        end: formatDateString(endOfMonth)
      };
    }
    case 'last_month': {
      const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        start: formatDateString(startOfLastMonth),
        end: formatDateString(endOfLastMonth)
      };
    }
    case 'custom': {
      if (customRange && customRange.startDate && customRange.endDate) {
        return { start: customRange.startDate, end: customRange.endDate };
      }
      // Fallback to today
      const todayStr = formatDateString(today);
      return { start: todayStr, end: todayStr };
    }
    default: {
      const todayStr = formatDateString(today);
      return { start: todayStr, end: todayStr };
    }
  }
};

/**
 * Format Firestore Timestamp or Date to HH:MM AM/PM
 */
export const formatTimeAmPm = (timestamp: any): string => {
  if (!timestamp) return '-';
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};
