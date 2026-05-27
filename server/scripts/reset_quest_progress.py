"""Reset quest progress for local testing.

Wipes every row in user_quest_progress and every quest-issued reward
(rewards.code LIKE 'QUEST-%'). The Quest catalogue itself is left alone.

Usage:
    cd server && PYTHONPATH=. python3 scripts/reset_quest_progress.py
    cd server && PYTHONPATH=. python3 scripts/reset_quest_progress.py <user_email>
"""
import sys

from app.db.session import SessionLocal
from app.modules.quest.models import UserQuestProgress
from app.modules.user.models import Reward, User


def reset(email: str | None = None) -> None:
    db = SessionLocal()
    try:
        progress_q = db.query(UserQuestProgress)
        reward_q = db.query(Reward).filter(Reward.code.like("QUEST-%"))

        if email:
            user = db.query(User).filter(User.email == email.lower()).first()
            if not user:
                print(f"No user with email {email!r}")
                return
            progress_q = progress_q.filter(UserQuestProgress.user_id == user.id)
            reward_q = reward_q.filter(Reward.user_id == user.id)
            scope = f"user {email}"
        else:
            scope = "ALL users"

        prog_n = progress_q.delete(synchronize_session=False)
        rew_n = reward_q.delete(synchronize_session=False)
        db.commit()
        print(f"Reset {scope}: removed {prog_n} progress rows, {rew_n} quest rewards.")
    finally:
        db.close()


if __name__ == "__main__":
    reset(sys.argv[1] if len(sys.argv) > 1 else None)
