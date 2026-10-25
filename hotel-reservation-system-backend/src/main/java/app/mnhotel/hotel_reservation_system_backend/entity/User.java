package app.mnhotel.hotel_reservation_system_backend.entity;

import java.time.LocalDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name="users")
public class User {
    @Column(nullable=false)
    @Builder.Default
    private String role = "USER";
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name="username", unique = true, nullable = false)
    private String username;
    
    @Column(name="password")
    private String password;
    
    @Column(name="email", unique = true, nullable = false)
    private String email;
    
    @Column(name="created_at")
    private LocalDateTime createdAt;
    
    @OneToMany(mappedBy = "user", fetch = FetchType.LAZY)
    @JsonIgnore
    private List<Reservation> reservations;
    
    @OneToMany(mappedBy = "user", fetch = FetchType.LAZY)
    private List<Review> reviews;

}
