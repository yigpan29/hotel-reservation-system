/<\/project>/ {
    while ((getline entry < "/checks/flyway-profile.xml") > 0) print entry
}
{ print }
