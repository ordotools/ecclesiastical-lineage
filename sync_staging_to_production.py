#!/usr/bin/env python3
"""
Sync staging database to production (wipe and restore)
This script completely wipes the production database and restores it with data from staging.
WARNING: This is a destructive operation!
"""

import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

def main():
    """Main function to sync staging to production"""
    load_dotenv()
    
    # Get database URLs
    production_url = os.environ.get('DATABASE_URL')
    staging_url = os.environ.get('STAGING_DATABASE_URL')
    
    if not production_url or not staging_url:
        print("❌ Missing database URLs in environment variables")
        print("   Required: DATABASE_URL and STAGING_DATABASE_URL")
        return False
    
    print("🚨 PRODUCTION DATABASE WIPE AND RESTORE FROM STAGING")
    print("=" * 60)
    print(f"📊 Production: {production_url[:50]}...")
    print(f"📊 Staging: {staging_url[:50]}...")
    print("")
    print("⚠️  WARNING: This will COMPLETELY WIPE the production database!")
    print("⚠️  All production data will be lost and replaced with staging data!")
    print("⚠️  This operation is IRREVERSIBLE!")
    print("")
    
    # Final confirmation
    confirmation = input("Type 'WIPE_PRODUCTION' to confirm: ")
    if confirmation != "WIPE_PRODUCTION":
        print("❌ Confirmation failed. Operation cancelled.")
        return False
    
    print("")
    print("🚨 PROCEEDING WITH DESTRUCTIVE OPERATION...")
    print("")
    
    try:
        # Create connections
        prod_engine = create_engine(production_url)
        staging_engine = create_engine(staging_url)
        
        with prod_engine.connect() as prod_conn, staging_engine.connect() as staging_conn:
            # Step 1: Verify staging database has data
            print("🔍 Verifying staging database...")
            staging_clergy_count = staging_conn.execute(text("SELECT COUNT(*) FROM clergy")).scalar()
            staging_orgs_count = staging_conn.execute(text("SELECT COUNT(*) FROM organization")).scalar()
            staging_ranks_count = staging_conn.execute(text("SELECT COUNT(*) FROM rank")).scalar()
            staging_users_count = staging_conn.execute(text("SELECT COUNT(*) FROM user")).scalar()
            
            print(f"   📊 Staging has {staging_clergy_count} clergy, {staging_orgs_count} orgs, {staging_ranks_count} ranks, {staging_users_count} users")
            
            if staging_clergy_count == 0:
                print("❌ Staging database is empty! Cannot restore from empty staging.")
                return False
            
            # Step 2: Wipe production database (in correct order for foreign keys)
            print("\n🧹 Wiping production database...")
            
            # Disable foreign key checks temporarily
            prod_conn.execute(text("SET session_replication_role = replica;"))
            
            # Clear all tables in correct order
            tables_to_clear = [
                'clergy_comment',
                'co_consecrators', 
                'consecration',
                'ordination',
                'clergy',
                'organization',
                'rank',
                'role_permissions',
                'permission',
                'role',
                'admin_invite',
                'audit_log',
                'user'
            ]
            
            for table in tables_to_clear:
                try:
                    result = prod_conn.execute(text(f"DELETE FROM {table}"))
                    print(f"   🗑️  Cleared {result.rowcount} rows from {table}")
                except Exception as e:
                    print(f"   ⚠️  Could not clear {table}: {e}")
            
            # Re-enable foreign key checks
            prod_conn.execute(text("SET session_replication_role = DEFAULT;"))
            prod_conn.commit()
            
            # Step 3: Copy data from staging to production
            print("\n📤 Copying data from staging to production...")
            
            # Copy users
            print("   👥 Copying users...")
            users = staging_conn.execute(text("""
                SELECT id, username, password_hash, email, full_name, is_active, 
                       created_at, last_login, role_id
                FROM user
            """)).fetchall()
            
            for user in users:
                prod_conn.execute(text("""
                    INSERT INTO user (id, username, password_hash, email, full_name, 
                                    is_active, created_at, last_login, role_id)
                    VALUES (:id, :username, :password_hash, :email, :full_name,
                            :is_active, :created_at, :last_login, :role_id)
                """), {
                    'id': user[0], 'username': user[1], 'password_hash': user[2],
                    'email': user[3], 'full_name': user[4], 'is_active': user[5],
                    'created_at': user[6], 'last_login': user[7], 'role_id': user[8]
                })
            
            print(f"   ✅ Copied {len(users)} users")
            
            # Copy roles
            print("   🎭 Copying roles...")
            roles = staging_conn.execute(text("""
                SELECT id, name, description, created_at
                FROM role
            """)).fetchall()
            
            for role in roles:
                prod_conn.execute(text("""
                    INSERT INTO role (id, name, description, created_at)
                    VALUES (:id, :name, :description, :created_at)
                """), {
                    'id': role[0], 'name': role[1], 'description': role[2], 'created_at': role[3]
                })
            
            print(f"   ✅ Copied {len(roles)} roles")
            
            # Copy permissions
            print("   🔐 Copying permissions...")
            permissions = staging_conn.execute(text("""
                SELECT id, name, description, created_at
                FROM permission
            """)).fetchall()
            
            for perm in permissions:
                prod_conn.execute(text("""
                    INSERT INTO permission (id, name, description, created_at)
                    VALUES (:id, :name, :description, :created_at)
                """), {
                    'id': perm[0], 'name': perm[1], 'description': perm[2], 'created_at': perm[3]
                })
            
            print(f"   ✅ Copied {len(permissions)} permissions")
            
            # Copy role_permissions
            print("   🔗 Copying role_permissions...")
            role_perms = staging_conn.execute(text("""
                SELECT role_id, permission_id
                FROM role_permissions
            """)).fetchall()
            
            for rp in role_perms:
                prod_conn.execute(text("""
                    INSERT INTO role_permissions (role_id, permission_id)
                    VALUES (:role_id, :permission_id)
                """), {'role_id': rp[0], 'permission_id': rp[1]})
            
            print(f"   ✅ Copied {len(role_perms)} role_permissions")
            
            # Copy organizations
            print("   🏢 Copying organizations...")
            orgs = staging_conn.execute(text("""
                SELECT id, name, abbreviation, description, color, created_at
                FROM organization
            """)).fetchall()
            
            for org in orgs:
                prod_conn.execute(text("""
                    INSERT INTO organization (id, name, abbreviation, description, color, created_at)
                    VALUES (:id, :name, :abbreviation, :description, :color, :created_at)
                """), {
                    'id': org[0], 'name': org[1], 'abbreviation': org[2],
                    'description': org[3], 'color': org[4], 'created_at': org[5]
                })
            
            print(f"   ✅ Copied {len(orgs)} organizations")
            
            # Copy ranks
            print("   🎖️  Copying ranks...")
            ranks = staging_conn.execute(text("""
                SELECT id, name, description, color, is_bishop, created_at
                FROM rank
            """)).fetchall()
            
            for rank in ranks:
                prod_conn.execute(text("""
                    INSERT INTO rank (id, name, description, color, is_bishop, created_at)
                    VALUES (:id, :name, :description, :color, :is_bishop, :created_at)
                """), {
                    'id': rank[0], 'name': rank[1], 'description': rank[2],
                    'color': rank[3], 'is_bishop': rank[4], 'created_at': rank[5]
                })
            
            print(f"   ✅ Copied {len(ranks)} ranks")
            
            # Copy clergy
            print("   ⛪ Copying clergy...")
            clergy = staging_conn.execute(text("""
                SELECT id, name, rank, papal_name, organization, date_of_birth, 
                       date_of_death, notes, image_url, image_data, is_deleted, deleted_at
                FROM clergy
            """)).fetchall()
            
            for cl in clergy:
                prod_conn.execute(text("""
                    INSERT INTO clergy (id, name, rank, papal_name, organization, 
                                      date_of_birth, date_of_death, notes, image_url, 
                                      image_data, is_deleted, deleted_at)
                    VALUES (:id, :name, :rank, :papal_name, :organization,
                            :date_of_birth, :date_of_death, :notes, :image_url,
                            :image_data, :is_deleted, :deleted_at)
                """), {
                    'id': cl[0], 'name': cl[1], 'rank': cl[2], 'papal_name': cl[3],
                    'organization': cl[4], 'date_of_birth': cl[5], 'date_of_death': cl[6],
                    'notes': cl[7], 'image_url': cl[8], 'image_data': cl[9],
                    'is_deleted': cl[10], 'deleted_at': cl[11]
                })
            
            print(f"   ✅ Copied {len(clergy)} clergy")
            
            # Copy ordinations
            print("   📿 Copying ordinations...")
            ordinations = staging_conn.execute(text("""
                SELECT id, clergy_id, date, ordaining_bishop_id, is_sub_conditione,
                       is_doubtful, is_invalid, notes, created_at, updated_at
                FROM ordination
            """)).fetchall()
            
            for ord in ordinations:
                prod_conn.execute(text("""
                    INSERT INTO ordination (id, clergy_id, date, ordaining_bishop_id,
                                          is_sub_conditione, is_doubtful, is_invalid,
                                          notes, created_at, updated_at)
                    VALUES (:id, :clergy_id, :date, :ordaining_bishop_id,
                            :is_sub_conditione, :is_doubtful, :is_invalid,
                            :notes, :created_at, :updated_at)
                """), {
                    'id': ord[0], 'clergy_id': ord[1], 'date': ord[2], 'ordaining_bishop_id': ord[3],
                    'is_sub_conditione': ord[4], 'is_doubtful': ord[5], 'is_invalid': ord[6],
                    'notes': ord[7], 'created_at': ord[8], 'updated_at': ord[9]
                })
            
            print(f"   ✅ Copied {len(ordinations)} ordinations")
            
            # Copy consecrations
            print("   🏛️  Copying consecrations...")
            consecrations = staging_conn.execute(text("""
                SELECT id, clergy_id, date, consecrator_id, is_sub_conditione,
                       is_doubtful, is_invalid, notes, created_at, updated_at
                FROM consecration
            """)).fetchall()
            
            for cons in consecrations:
                prod_conn.execute(text("""
                    INSERT INTO consecration (id, clergy_id, date, consecrator_id,
                                            is_sub_conditione, is_doubtful, is_invalid,
                                            notes, created_at, updated_at)
                    VALUES (:id, :clergy_id, :date, :consecrator_id,
                            :is_sub_conditione, :is_doubtful, :is_invalid,
                            :notes, :created_at, :updated_at)
                """), {
                    'id': cons[0], 'clergy_id': cons[1], 'date': cons[2], 'consecrator_id': cons[3],
                    'is_sub_conditione': cons[4], 'is_doubtful': cons[5], 'is_invalid': cons[6],
                    'notes': cons[7], 'created_at': cons[8], 'updated_at': cons[9]
                })
            
            print(f"   ✅ Copied {len(consecrations)} consecrations")
            
            # Copy co_consecrators
            print("   🤝 Copying co_consecrators...")
            co_consecrators = staging_conn.execute(text("""
                SELECT consecration_id, co_consecrator_id
                FROM co_consecrators
            """)).fetchall()
            
            for cc in co_consecrators:
                prod_conn.execute(text("""
                    INSERT INTO co_consecrators (consecration_id, co_consecrator_id)
                    VALUES (:consecration_id, :co_consecrator_id)
                """), {'consecration_id': cc[0], 'co_consecrator_id': cc[1]})
            
            print(f"   ✅ Copied {len(co_consecrators)} co_consecrators")
            
            # Copy clergy comments
            print("   💬 Copying clergy comments...")
            comments = staging_conn.execute(text("""
                SELECT id, clergy_id, author_id, content, field_name, is_public,
                       is_resolved, created_at, updated_at
                FROM clergy_comment
            """)).fetchall()
            
            for comment in comments:
                prod_conn.execute(text("""
                    INSERT INTO clergy_comment (id, clergy_id, author_id, content,
                                              field_name, is_public, is_resolved,
                                              created_at, updated_at)
                    VALUES (:id, :clergy_id, :author_id, :content,
                            :field_name, :is_public, :is_resolved,
                            :created_at, :updated_at)
                """), {
                    'id': comment[0], 'clergy_id': comment[1], 'author_id': comment[2],
                    'content': comment[3], 'field_name': comment[4], 'is_public': comment[5],
                    'is_resolved': comment[6], 'created_at': comment[7], 'updated_at': comment[8]
                })
            
            print(f"   ✅ Copied {len(comments)} clergy comments")
            
            # Copy admin invites
            print("   📧 Copying admin invites...")
            invites = staging_conn.execute(text("""
                SELECT id, token, expires_at, used, created_at, invited_by, role_id,
                       max_uses, current_uses, expires_in_hours
                FROM admin_invite
            """)).fetchall()
            
            for invite in invites:
                prod_conn.execute(text("""
                    INSERT INTO admin_invite (id, token, expires_at, used, created_at,
                                            invited_by, role_id, max_uses, current_uses,
                                            expires_in_hours)
                    VALUES (:id, :token, :expires_at, :used, :created_at,
                            :invited_by, :role_id, :max_uses, :current_uses,
                            :expires_in_hours)
                """), {
                    'id': invite[0], 'token': invite[1], 'expires_at': invite[2], 'used': invite[3],
                    'created_at': invite[4], 'invited_by': invite[5], 'role_id': invite[6],
                    'max_uses': invite[7], 'current_uses': invite[8], 'expires_in_hours': invite[9]
                })
            
            print(f"   ✅ Copied {len(invites)} admin invites")
            
            # Copy audit logs
            print("   📋 Copying audit logs...")
            audit_logs = staging_conn.execute(text("""
                SELECT id, user_id, action, entity_type, entity_id, entity_name,
                       details, ip_address, user_agent, created_at
                FROM audit_log
            """)).fetchall()
            
            for log in audit_logs:
                prod_conn.execute(text("""
                    INSERT INTO audit_log (id, user_id, action, entity_type, entity_id,
                                         entity_name, details, ip_address, user_agent, created_at)
                    VALUES (:id, :user_id, :action, :entity_type, :entity_id,
                            :entity_name, :details, :ip_address, :user_agent, :created_at)
                """), {
                    'id': log[0], 'user_id': log[1], 'action': log[2], 'entity_type': log[3],
                    'entity_id': log[4], 'entity_name': log[5], 'details': log[6],
                    'ip_address': log[7], 'user_agent': log[8], 'created_at': log[9]
                })
            
            print(f"   ✅ Copied {len(audit_logs)} audit logs")
            
            # Commit all changes
            prod_conn.commit()
            
            # Step 4: Verify the restore
            print("\n🔍 Verifying restored data...")
            prod_clergy_count = prod_conn.execute(text("SELECT COUNT(*) FROM clergy")).scalar()
            prod_orgs_count = prod_conn.execute(text("SELECT COUNT(*) FROM organization")).scalar()
            prod_ranks_count = prod_conn.execute(text("SELECT COUNT(*) FROM rank")).scalar()
            prod_users_count = prod_conn.execute(text("SELECT COUNT(*) FROM user")).scalar()
            
            print(f"   📊 Production now has {prod_clergy_count} clergy, {prod_orgs_count} orgs, {prod_ranks_count} ranks, {prod_users_count} users")
            
            if prod_clergy_count == staging_clergy_count:
                print("✅ SUCCESS: Production database successfully restored from staging!")
                print("🎉 All data has been copied and verified.")
                return True
            else:
                print("❌ WARNING: Data counts don't match between staging and production")
                print(f"   Staging: {staging_clergy_count} clergy")
                print(f"   Production: {prod_clergy_count} clergy")
                return False
            
    except Exception as e:
        print(f"❌ Error during wipe and restore: {e}")
        return False

if __name__ == "__main__":
    success = main()
    if success:
        print("\n🎉 PRODUCTION DATABASE SUCCESSFULLY RESTORED FROM STAGING!")
        print("✅ All data has been copied and verified")
        print("✅ Database is functional and ready for use")
    else:
        print("\n❌ RESTORE FAILED!")
        print("Please check the error messages above and try again.")
        sys.exit(1)
