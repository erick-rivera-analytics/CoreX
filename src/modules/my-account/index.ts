export type MyAccountNotificationPreferences = {
  inAppTaskAssigned: boolean;
  inAppTaskDue: boolean;
  inAppReminder: boolean;
  emailTaskAssigned: boolean;
  emailTaskDue: boolean;
  emailReminder: boolean;
};

export type MyAccountProfile = {
  authUserId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bioText: string;
  localeCode: string;
  timezoneName: string;
  themeCode: string;
  defaultRoute: string;
  defaultCalendarViewCode: string;
  defaultTaskViewCode: string;
  weekStartIso: 1 | 7;
  notificationPreferences: MyAccountNotificationPreferences;
  lastUpdatedAt: string;
};

export type MyAccountWorkSummary = {
  activeSpaces: number;
  pendingToday: number;
  overdue: number;
  inProgress: number;
  nextEventLabel: string;
  nextReminderLabel: string;
};

export type MyAccountInitialData = {
  profile: MyAccountProfile;
  workSummary: MyAccountWorkSummary;
};

export { MyAccountPage } from "@/modules/my-account/components/my-account-page";
export { loadMyAccountPageData } from "@/modules/my-account/server/load-my-account-page";
