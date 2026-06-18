from datetime import datetime

from sqlmodel import Field, Relationship, SQLModel


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    telegram_id: str = Field(unique=True, index=True)
    username: str | None = Field(default=None)
    full_name: str
    points: float = Field(default=0.0)

    # Relationships
    predictions: list["Prediction"] = Relationship(back_populates="user")
    tournament_prediction: "TournamentPrediction" = Relationship(
        back_populates="user", sa_relationship_kwargs={"uselist": False}
    )


class Match(SQLModel, table=True):
    # We will use the API-Sports fixture ID as our primary key
    id: int = Field(primary_key=True)
    home_team: str
    away_team: str
    home_score: int | None = Field(default=None)
    away_score: int | None = Field(default=None)
    status: str  # e.g., "NS" (Not Started), "FT" (Full Time), "1H", "2H"
    date: datetime
    group: str | None = Field(default=None)
    stage: str | None = Field(default=None)
    last_updated: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    predictions: list["Prediction"] = Relationship(back_populates="match")


class Prediction(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    match_id: int = Field(foreign_key="match.id", index=True)
    home_score: int
    away_score: int
    penalty_winner_home: bool | None = Field(default=None, nullable=True)
    points_earned: float = Field(default=0.0)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    user: User = Relationship(back_populates="predictions")
    match: Match = Relationship(back_populates="predictions")


class TournamentPrediction(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True, unique=True)
    champion: str | None = Field(default=None)
    runner_up: str | None = Field(default=None)
    top_scorer: str | None = Field(default=None)
    best_goalkeeper: str | None = Field(default=None)
    surprise_team: str | None = Field(default=None)
    last_updated: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    user: User = Relationship(back_populates="tournament_prediction")


class DailySummary(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    summary_date: str = Field(unique=True, index=True)  # Formato YYYY-MM-DD
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


