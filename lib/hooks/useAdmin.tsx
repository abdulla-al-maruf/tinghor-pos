import { useState, useEffect, useCallback } from 'react';
import { User } from '../../types';
import { supabase } from '../supabase';

/**
 * Hook for admin-related functionality with server-side validation
 * This provides a more secure alternative to client-side isAdmin checks
 */
export function useAdmin(currentUser: User | null) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);

  // Check admin status with server-side verification
  const verifyAdminStatus = useCallback(async () => {
    if (!currentUser) {
      setIsAdmin(false);
      setAdminPermissions([]);
      setIsLoading(false);
      return;
    }

    try {
      // First check client-side role (fast)
      const clientSideAdmin = currentUser.role === 'admin';
      setIsAdmin(clientSideAdmin);

      // Then verify with server (more secure)
      if (clientSideAdmin) {
        const { data, error } = await supabase
          .from('profiles')
          .select('role, permissions')
          .eq('id', currentUser.id)
          .single();

        if (error) {
          console.error('Error verifying admin status:', error);
          setIsAdmin(false);
          setAdminPermissions([]);
        } else if (data) {
          const serverSideAdmin = data.role === 'admin';
          setIsAdmin(serverSideAdmin);
          
          // Load permissions if available
          if (data.permissions && Array.isArray(data.permissions)) {
            setAdminPermissions(data.permissions);
          }
        }
      } else {
        setAdminPermissions([]);
      }
    } catch (error) {
      console.error('Error in admin verification:', error);
      setIsAdmin(false);
      setAdminPermissions([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  // Check specific permission
  const hasPermission = useCallback((permission: string): boolean => {
    if (!isAdmin) return false;
    // If we have specific permissions array, check it
    if (adminPermissions.length > 0) {
      return adminPermissions.includes(permission);
    }
    // Otherwise, admin has all permissions
    return true;
  }, [isAdmin, adminPermissions]);

  // Check if user can access a specific resource
  const canAccessResource = useCallback(async (
    resourceType: string,
    resourceId?: string,
    action: 'read' | 'write' | 'delete' = 'read'
  ): Promise<boolean> => {
    if (!currentUser) return false;
    
    // For now, implement basic checks. In production, this would
    // make actual API calls to check RLS policies
    if (isAdmin) return true;
    
    // Non-admin users have limited access
    switch (resourceType) {
      case 'sales':
        return action === 'read'; // Managers can only read sales
      case 'inventory':
        return action === 'read'; // Managers can only read inventory
      case 'settings':
        return false; // Only admins can access settings
      case 'users':
        return false; // Only admins can access users
      default:
        return action === 'read'; // Default to read-only for other resources
    }
  }, [currentUser, isAdmin]);

  // Initialize
  useEffect(() => {
    verifyAdminStatus();
  }, [verifyAdminStatus]);

  return {
    isAdmin,
    isLoading,
    adminPermissions,
    hasPermission,
    canAccessResource,
    verifyAdminStatus,
  };
}

/**
 * Higher-order component for protecting admin-only components
 * This should be used in conjunction with server-side RLS policies
 */
export function withAdminCheck<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredPermission?: string
) {
  return function AdminCheckedComponent(props: P & { currentUser: User | null }) {
    const { currentUser, ...restProps } = props;
    const { isAdmin, isLoading, hasPermission } = useAdmin(currentUser);

    if (isLoading) {
      return <div className="p-4 text-center">Checking permissions...</div>;
    }

    if (!isAdmin) {
      return (
        <div className="p-6 text-center bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-lg font-bold text-red-700">Access Denied</h3>
          <p className="text-red-600">Admin privileges required to access this section.</p>
        </div>
      );
    }

    if (requiredPermission && !hasPermission(requiredPermission)) {
      return (
        <div className="p-6 text-center bg-amber-50 border border-amber-200 rounded-lg">
          <h3 className="text-lg font-bold text-amber-700">Insufficient Permissions</h3>
          <p className="text-amber-600">You don't have permission to access this feature.</p>
        </div>
      );
    }

    return <WrappedComponent {...restProps as P} />;
  };
}

/**
 * RLS Policy templates for Supabase
 * These SQL templates should be run in the Supabase SQL editor
 */
export const RLSPolicyTemplates = {
  // Profiles table policies
  profiles: {
    selectOwnProfile: `
      CREATE POLICY "Users can view own profile" ON profiles
        FOR SELECT USING (auth.uid() = id);
    `,
    adminManageAllProfiles: `
      CREATE POLICY "Admins can manage all profiles" ON profiles
        FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
    `,
    updateOwnProfile: `
      CREATE POLICY "Users can update own profile" ON profiles
        FOR UPDATE USING (auth.uid() = id);
    `,
  },

  // Store settings table policies
  store_settings: {
    adminOnly: `
      CREATE POLICY "Only admins can manage settings" ON store_settings
        FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
    `,
    readOnlyForManagers: `
      CREATE POLICY "Managers can read settings" ON store_settings
        FOR SELECT USING (auth.jwt() ->> 'role' IN ('admin', 'manager'));
    `,
  },

  // Sales table policies
  sales: {
    everyoneCanRead: `
      CREATE POLICY "Everyone can read sales" ON sales
        FOR SELECT USING (true);
    `,
    adminManageSales: `
      CREATE POLICY "Admins can manage all sales" ON sales
        FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
    `,
    managerCreateSales: `
      CREATE POLICY "Managers can create sales" ON sales
        FOR INSERT WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'manager'));
    `,
    updateOwnSales: `
      CREATE POLICY "Users can update own sales" ON sales
        FOR UPDATE USING (sold_by = auth.jwt() ->> 'email');
    `,
  },

  // Product groups table policies
  product_groups: {
    everyoneCanRead: `
      CREATE POLICY "Everyone can read inventory" ON product_groups
        FOR SELECT USING (true);
    `,
    adminManageInventory: `
      CREATE POLICY "Admins can manage inventory" ON product_groups
        FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
    `,
  },

  // Generic policy for other tables
  genericAdminOnly: (tableName: string) => `
    CREATE POLICY "Only admins can access ${tableName}" ON ${tableName}
      FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
  `,

  genericReadOnlyForManagers: (tableName: string) => `
    CREATE POLICY "Managers can read ${tableName}" ON ${tableName}
      FOR SELECT USING (auth.jwt() ->> 'role' IN ('admin', 'manager'));
  `,
};

/**
 * Function to generate all RLS policies for the application
 */
export function generateAllRLSPolicies(): string {
  const policies: string[] = [];
  
  // Enable RLS on all tables
  const tables = [
    'profiles', 'store_settings', 'sales', 'sale_items',
    'product_groups', 'product_variants', 'purchases', 'purchase_items',
    'suppliers', 'expenses', 'employees', 'salary_records',
    'stock_movements', 'payment_allocations', 'activity_logs'
  ];
  
  policies.push('-- Enable RLS on all tables');
  tables.forEach(table => {
    policies.push(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
  });
  
  policies.push('\n-- Profiles table policies');
  policies.push(RLSPolicyTemplates.profiles.selectOwnProfile);
  policies.push(RLSPolicyTemplates.profiles.adminManageAllProfiles);
  policies.push(RLSPolicyTemplates.profiles.updateOwnProfile);
  
  policies.push('\n-- Store settings policies');
  policies.push(RLSPolicyTemplates.store_settings.adminOnly);
  
  policies.push('\n-- Sales table policies');
  policies.push(RLSPolicyTemplates.sales.everyoneCanRead);
  policies.push(RLSPolicyTemplates.sales.adminManageSales);
  policies.push(RLSPolicyTemplates.sales.managerCreateSales);
  policies.push(RLSPolicyTemplates.sales.updateOwnSales);
  
  policies.push('\n-- Product groups policies');
  policies.push(RLSPolicyTemplates.product_groups.everyoneCanRead);
  policies.push(RLSPolicyTemplates.product_groups.adminManageInventory);
  
  policies.push('\n-- Other tables: admin only');
  const otherTables = ['purchases', 'suppliers', 'expenses', 'employees', 'salary_records', 'activity_logs'];
  otherTables.forEach(table => {
    policies.push(RLSPolicyTemplates.genericAdminOnly(table));
  });
  
  return policies.join('\n');
}