from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

    watchlists = relationship("Watchlist", back_populates="user")
    portfolio_items = relationship("PortfolioItem", back_populates="user")

class Watchlist(Base):
    __tablename__ = "watchlists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    ticker = Column(String, nullable=False)
    name = Column(String, nullable=False)

    user = relationship("User", back_populates="watchlists")

    __table_args__ = (UniqueConstraint('user_id', 'ticker', name='_user_ticker_uc'),)

class PortfolioItem(Base):
    __tablename__ = "portfolio_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    ticker = Column(String, nullable=False)
    name = Column(String, nullable=False)
    shares = Column(Float, nullable=False)
    purchase_date = Column(Date, nullable=False)
    purchase_price = Column(Float, nullable=False)

    user = relationship("User", back_populates="portfolio_items")
