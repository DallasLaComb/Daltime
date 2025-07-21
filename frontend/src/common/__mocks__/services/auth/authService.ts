// Mock for AuthService
export class AuthService {
  static async register(userData: any) {
    // Mock successful response
    return {
      success: true,
      message: 'User registered successfully',
      data: {
        userid: 'mock-user-id',
        companyid: userData.companyId,
        firstname: userData.firstName,
        lastname: userData.lastName,
        phonenumber: parseInt(userData.phoneNumber),
        email: userData.email,
        role: userData.role,
      },
    };
  }
}
