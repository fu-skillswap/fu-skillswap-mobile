/** Khoá TanStack Query của luồng đăng ký mentor */
export const dangKyKeys = {
  all: ['mentorRegistration'] as const,
  verification: () => [...dangKyKeys.all, 'verification'] as const,
};
