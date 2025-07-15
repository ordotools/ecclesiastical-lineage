#!/usr/bin/env python3
"""
Script to add sample clergy data with relationships for testing the lineage visualization.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from datetime import datetime

def add_sample_data():
    from app import app, db, Clergy  # Import inside function to avoid circular import
    """Add sample clergy data for the Roman Catholic Institute."""
    with app.app_context():
        Clergy.query.delete()
        db.session.commit()

        # Bishops (from https://romancatholicinstitute.org/about/)
        bishop_sanborn = Clergy(
            name="Donald J. Sanborn",
            rank="Bishop",
            organization="Roman Catholic Institute",
            notes="Superior General, Rector of Most Holy Trinity Seminary"
        )
        bishop_selway = Clergy(
            name="Joseph Selway",
            rank="Bishop",
            organization="Roman Catholic Institute",
            notes="Consecrated by Donald Sanborn on February 22, 2018"
        )
        bishop_fliess = Clergy(
            name="Germán Fliess",
            rank="Bishop",
            organization="Roman Catholic Institute",
            notes="Consecrated by Donald Sanborn in 2022"
        )

        # Priests (from <h3 class="fl-callout-title"><span class="fl-callout-title-text">Name</span></h3> blocks)
        priest_desposito = Clergy(
            name="Nicolás E. Despósito",
            rank="Priest",
            organization="Roman Catholic Institute",
            notes="Professor at Most Holy Trinity Seminary"
        )
        priest_palma = Clergy(
            name="Federico Palma",
            rank="Priest",
            organization="Roman Catholic Institute",
            notes="Pastor of RCI chapels in Australia"
        )
        priest_trytek = Clergy(
            name="Ojciec Rafal Trytek",
            rank="Priest",
            organization="Roman Catholic Institute",
            notes="Krakow, Poland; joined RCI in 2017"
        )
        priest_eldracher = Clergy(
            name="Philip A. Eldracher",
            rank="Priest",
            organization="Roman Catholic Institute",
            notes="Assistant Pastor in Australia"
        )
        priest_dutertre = Clergy(
            name="Damien Dutertre",
            rank="Priest",
            organization="Roman Catholic Institute",
            notes="Teaches Dogmatic Theology, Nantes, France"
        )
        priest_petrizzi = Clergy(
            name="Luke Petrizzi",
            rank="Priest",
            organization="Roman Catholic Institute",
            notes="Teaches Church History and Latin at MHT Seminary"
        )
        priest_delachanonie = Clergy(
            name="Henry de La Chanonie",
            rank="Priest",
            organization="Roman Catholic Institute",
            notes="Pastoral work in Nantes, France"
        )
        priest_desaye = Clergy(
            name="Michael DeSaye",
            rank="Priest",
            organization="Roman Catholic Institute",
            notes="Associate at Queen of All Saints Chapel, Brooksville, FL"
        )
        priest_bayer = Clergy(
            name="Tobias Bayer",
            rank="Priest",
            organization="Roman Catholic Institute",
            notes="Secretary to Bishop Sanborn"
        )
        priest_barnes = Clergy(
            name="Gregory Barnes",
            rank="Priest",
            organization="Roman Catholic Institute",
            notes="Teaches at Queen of All Saints Academy, assists at chapels in FL and AZ"
        )
        priest_gilchrist = Clergy(
            name="Aedan Gilchrist",
            rank="Priest",
            organization="Roman Catholic Institute",
            notes="Missions in British Isles, assists in Nantes, France"
        )
        priest_marshall = Clergy(
            name="James Marshall",
            rank="Priest",
            organization="Roman Catholic Institute",
            notes="Serves at Florida chapels, ordained by Bp. Fliess in 2024"
        )

        # Add all clergy to the session
        db.session.add_all([
            bishop_sanborn, bishop_selway, bishop_fliess,
            priest_desposito, priest_palma, priest_trytek, priest_eldracher, priest_dutertre,
            priest_petrizzi, priest_delachanonie, priest_desaye, priest_bayer, priest_barnes,
            priest_gilchrist, priest_marshall
        ])
        db.session.commit()

        # Relationships (example: Selway consecrated by Sanborn, Fliess by Sanborn, etc.)
        bishop_selway.consecrator_id = bishop_sanborn.id
        bishop_fliess.consecrator_id = bishop_sanborn.id
        # Optionally, set ordaining_bishop_id for priests if known
        db.session.commit()

if __name__ == "__main__":
    add_sample_data() 