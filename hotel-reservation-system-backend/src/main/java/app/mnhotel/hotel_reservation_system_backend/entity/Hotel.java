package app.mnhotel.hotel_reservation_system_backend.entity;

import java.util.List;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "hotels")
public class Hotel {
    @Column(nullable=false)
    @Builder.Default
    private Boolean active = true;
	@Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
	
	@Column(name="name")
	private String name;
	
	@Column(name="location")
    private String location;
	
	@Column(name="description")
	private String description;
	
	@Column(name="rating")
	private Double rating;
	
	@OneToMany(mappedBy = "hotel")
 	@JsonIgnoreProperties
    private List<Room> rooms;
	
	@OneToMany(mappedBy = "hotel", fetch = FetchType.LAZY)
	private List<Review> reviews;
}
