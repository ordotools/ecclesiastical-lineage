from app import db, app
from sqlalchemy import inspect, Column, Integer, String, DateTime, Boolean, ForeignKey

def migrate():
    with app.app_context():
        inspector = inspect(db.engine)
        if 'admin_invite' in inspector.get_table_names():
            print('admin_invite table already exists. Migration skipped.')
            return
        # Create the table manually
        from sqlalchemy import Table, MetaData
        metadata = MetaData(bind=db.engine)
        admin_invite = Table('admin_invite', metadata,
            Column('id', Integer, primary_key=True),
            Column('token', String(128), unique=True, nullable=False),
            Column('expires_at', DateTime, nullable=False),
            Column('used', Boolean, default=False),
            Column('created_at', DateTime),
            Column('invited_by', Integer, ForeignKey('user.id')),
        )
        admin_invite.create()
        print('admin_invite table created.')

if __name__ == '__main__':
    migrate() 