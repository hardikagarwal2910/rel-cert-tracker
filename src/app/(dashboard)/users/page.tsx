import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUsers } from '@/lib/db/users';
import { can, canManageUser, assignableRoles } from '@/lib/auth/permissions';
import UserActiveToggle from './UserActiveToggle';
import UserRoleControl from './UserRoleControl';
import NewUserButton from './NewUserButton';
import UserPasswordReset from './UserPasswordReset';

export default async function UsersPage() {
  const headersList = headers();
  const role = headersList.get('x-user-role') ?? undefined;
  const currentUserId = headersList.get('x-user-id') ?? undefined;
  if (!can(role, 'MANAGE_USERS')) redirect('/');

  const roleOptions = assignableRoles(role);
  const users = await getUsers().catch(() => []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#878687' }}>Users</h1>
        <NewUserButton currentRole={role} />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase border-b border-gray-200">
              <th className="px-4 py-2">Username</th>
              <th className="px-4 py-2">Display Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Last Login</th>
              <th className="px-4 py-2">Active</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-500">No users found.</td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-800">{u.username}</td>
                  <td className="px-4 py-2 text-gray-600">{u.display_name ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{u.email ?? '—'}</td>
                  <td className="px-4 py-2">
                    {canManageUser(role, u.role) && u.id !== currentUserId ? (
                      <UserRoleControl userId={u.id} username={u.username} role={u.role} options={roleOptions} />
                    ) : (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {u.role}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-2">
                    {canManageUser(role, u.role) ? (
                      <UserActiveToggle userId={u.id} initialActive={u.active} />
                    ) : (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${u.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {canManageUser(role, u.role) && <UserPasswordReset userId={u.id} username={u.username} />}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
